#!/usr/bin/env python3
"""
Servidor jota-display.

Responsabilidades:
  - Servir los ficheros estáticos de la UI (index.html, app.js, components/, lib/)
  - Mantener un stream SSE en GET /events que el navegador escucha en tiempo real
  - Recibir actualizaciones de estado en POST /state (llamado por los hook scripts)
  - Controlar la pantalla del dispositivo vía WallPanel HTTP API

Modos de despliegue (variable JOTA_MODE):
  - "worker01" (defecto): WallPanel en 192.168.1.129:2971, HTTP+HTTPS
  - "termux":             WallPanel en localhost:2971, HTTP solo

Variables de entorno:
  JOTA_MODE = "worker01" | "termux"
"""
import json
import os
import ssl
import threading
import queue
import time
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# ── Configuración por entorno ─────────────────────────────────────────────────

TERMUX_MODE = os.getenv("JOTA_MODE", "worker01") == "termux"

if TERMUX_MODE:
    BASE_DIR        = Path.home() / "jota-display"
    WALLPANEL_URL   = "http://localhost:2971/api/command"
    HTTP_PORT       = 8766
    HTTPS_PORT      = None
    SSL_CERT        = None
    SSL_KEY         = None
else:
    BASE_DIR        = Path(__file__).parent.parent
    WALLPANEL_URL   = "http://192.168.1.129:2971/api/command"
    HTTP_PORT       = 8766
    HTTPS_PORT      = 8443
    SSL_CERT        = "/home/sito/kiosk_cert.pem"
    SSL_KEY         = "/home/sito/kiosk_key.pem"

STATE = {"state": "idle", "text": "", "ts": 0}
CLIENTS: list[queue.SimpleQueue] = []
CLIENTS_LOCK = threading.Lock()
AUTO_SLEEP_SECONDS = 8


# ---------------------------------------------------------------------------
# WallPanel
# ---------------------------------------------------------------------------

def _wallpanel_cmd(payload: dict) -> None:
    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            WALLPANEL_URL, data=data,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=3)
    except Exception:
        pass


def screen_wake():
    _wallpanel_cmd({"wake": True, "wakeTime": 180})


def screen_sleep():
    _wallpanel_cmd({"wake": False})


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

        else:
            # Servir cualquier fichero estático (components/, lib/, style.css, etc.)
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
        else:
            self.send_response(404)
            self.end_headers()


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mode_label = "termux" if TERMUX_MODE else "worker01"
    print(f"[jota-display] modo={mode_label}  base={BASE_DIR}  wallpanel={WALLPANEL_URL}")

    http_server = ThreadingHTTPServer(("0.0.0.0", HTTP_PORT), Handler)

    if HTTPS_PORT:
        https_server = ThreadingHTTPServer(("0.0.0.0", HTTPS_PORT), Handler)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(SSL_CERT, SSL_KEY)
        https_server.socket = ctx.wrap_socket(https_server.socket, server_side=True)
        threading.Thread(target=https_server.serve_forever, daemon=True).start()
        print(f"[jota-display] HTTPS en :{HTTPS_PORT}")

    print(f"[jota-display] HTTP  en :{HTTP_PORT}")
    http_server.serve_forever()
