#!/usr/bin/env python3
"""
Servidor jota-display.

Responsabilidades:
  - Servir la build de Vite desde dist/
  - Mantener un stream SSE en GET /events
  - Recibir actualizaciones de estado en POST /state
  - Controlar la pantalla del dispositivo vía Fully Kiosk Browser REST API
  - Leer y escribir configuración desde config/

Modos de despliegue (JOTA_MODE):
  - "" (defecto): build en dist/ relativa al repo, Fully configurable
  - "termux":     build en ~/jota-display/dist, Fully en localhost

Variables de entorno:
  JOTA_MODE             = "termux" | "" (defecto)
  JOTA_FULLY_URL        = URL base de Fully Kiosk (defecto: http://localhost:2323)
  JOTA_FULLY_PASSWORD   = contraseña del Remote Admin de Fully Kiosk
"""
import json
import os
import threading
import queue
import time
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# ── Configuración ─────────────────────────────────────────────────────────────

TERMUX_MODE      = os.getenv("JOTA_MODE", "") == "termux"
FULLY_URL        = os.getenv("JOTA_FULLY_URL", "http://localhost:2323")
FULLY_PASSWORD   = os.getenv("JOTA_FULLY_PASSWORD", "")
DEV_MODE         = os.getenv("JOTA_DEV", "false").lower() == "true"

if TERMUX_MODE:
    BASE_DIR = Path.home() / "jota-display" / "dist"
else:
    BASE_DIR = Path(__file__).parent.parent / "dist"

CONFIG_DIR = Path(__file__).parent.parent / "config"
HTTP_PORT  = 8766

STATE = {"state": "idle", "text": "", "ts": 0}
CLIENTS: list[queue.SimpleQueue] = []
CLIENTS_LOCK = threading.Lock()
AUTO_SLEEP_SECONDS = 8


# ---------------------------------------------------------------------------
# Fully Kiosk Browser
# ---------------------------------------------------------------------------

def _fully_cmd(cmd: str) -> None:
    try:
        params = f"?cmd={cmd}&type=json&password={FULLY_PASSWORD}"
        urllib.request.urlopen(FULLY_URL + "/" + params, timeout=3)
    except Exception:
        pass


def screen_wake():
    _fully_cmd("screenOn")


def screen_sleep():
    _fully_cmd("screenOff")


# ---------------------------------------------------------------------------
# Estado y SSE
# ---------------------------------------------------------------------------

def broadcast(data: dict) -> None:
    STATE.update(data)
    STATE["ts"] = time.time()
    msg = "data: " + json.dumps(STATE) + "\n\n"
    with CLIENTS_LOCK:
        dead = []
        for q in CLIENTS:
            try:
                q.put_nowait(msg)
            except Exception:
                dead.append(q)
        for q in dead:
            CLIENTS.remove(q)


def schedule_sleep(delay: float) -> None:
    ts = STATE["ts"]
    def _sleep():
        time.sleep(delay)
        if STATE["state"] == "response" and abs(STATE["ts"] - ts) < 0.5:
            broadcast({"state": "idle", "text": ""})
            screen_sleep()
    threading.Thread(target=_sleep, daemon=True).start()


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    MIME = {
        ".html": "text/html; charset=utf-8",
        ".js":   "application/javascript",
        ".css":  "text/css",
        ".json": "application/json",
        ".png":  "image/png",
    }

    def serve_file(self, rel_path: str):
        path = BASE_DIR / rel_path.lstrip("/")
        if not path.exists() or not path.is_file():
            self.send_response(404)
            self.end_headers()
            return
        data = path.read_bytes()
        mime = self.MIME.get(path.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def serve_file_abs(self, path: Path):
        if not path.exists() or not path.is_file():
            self.send_response(404)
            self.end_headers()
            return
        data = path.read_bytes()
        mime = self.MIME.get(path.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.serve_file("index.html")

        elif self.path == "/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            q: queue.SimpleQueue = queue.SimpleQueue()
            with CLIENTS_LOCK:
                CLIENTS.append(q)
            try:
                self.wfile.write(("data: " + json.dumps(STATE) + "\n\n").encode())
                self.wfile.flush()
            except Exception:
                with CLIENTS_LOCK:
                    try:
                        CLIENTS.remove(q)
                    except ValueError:
                        pass
                return

            while True:
                try:
                    msg = q.get(timeout=25)
                    self.wfile.write(msg.encode())
                    self.wfile.flush()
                except queue.Empty:
                    try:
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
                    except Exception:
                        break
                except Exception:
                    break

            with CLIENTS_LOCK:
                try:
                    CLIENTS.remove(q)
                except ValueError:
                    pass

        elif self.path == "/dev/ha-state":
            if not DEV_MODE:
                self.send_response(403)
                self.end_headers()
                return
            fixture = Path(__file__).parent.parent / "dev" / "fixtures" / "ha-state.json"
            self.serve_file_abs(fixture)

        elif self.path.startswith("/config/"):
            self.serve_file_abs(CONFIG_DIR / self.path[len("/config/"):])

        else:
            # SPA routes (no extension) → index.html; ficheros estáticos → sirve el fichero
            path_clean = self.path.split('?')[0]
            if '.' not in path_clean.split('/')[-1]:
                self.serve_file("index.html")
            else:
                self.serve_file(self.path)

    def do_POST(self):
        if self.path == "/state":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
            except Exception:
                self.send_response(400)
                self.end_headers()
                return

            new_state = data.get("state", "idle")
            broadcast(data)

            if new_state == "listening":
                threading.Thread(target=screen_wake, daemon=True).start()
            elif new_state == "response":
                schedule_sleep(AUTO_SLEEP_SECONDS)

            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")
        elif self.path == "/listen":
            broadcast({"state": "listening", "text": ""})
            threading.Thread(target=screen_wake, daemon=True).start()
            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")

        elif self.path.startswith("/config/") and self.path.endswith(".json"):
            name = self.path[len("/config/"):]
            if ".." in name or "/" in name.replace(".json", ""):
                self.send_response(400)
                self.end_headers()
                return
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                json.loads(body)
            except Exception:
                self.send_response(400)
                self.end_headers()
                return
            (CONFIG_DIR / name).write_bytes(body)
            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")

        else:
            self.send_response(404)
            self.end_headers()


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mode_label = "termux" if TERMUX_MODE else "generic"
    dev_label = "  DEV" if DEV_MODE else ""
    print(f"[jota-display] modo={mode_label}{dev_label}  base={BASE_DIR}  fully={FULLY_URL}")
    print(f"[jota-display] HTTP en :{HTTP_PORT}")
    ThreadingHTTPServer(("0.0.0.0", HTTP_PORT), Handler).serve_forever()
