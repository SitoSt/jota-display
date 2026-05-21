#!/usr/bin/env python3
"""
Servidor jota-display.

Responsabilidades:
  - Servir los ficheros estáticos de la UI (index.html, app.js, components/, lib/)
  - Mantener un stream SSE en GET /events que el navegador escucha en tiempo real
  - Recibir actualizaciones de estado en POST /state (llamado por los hook scripts)
  - Controlar la pantalla del dispositivo vía ADB (encender/apagar)

Modos de despliegue:
  - worker-01 (actual): sirve desde el repo, ADB a 192.168.1.129:32906
  - Termux en el teléfono (próximo): sirve desde ~/jota-display/, ADB a sí mismo

Puertos:
  - :8443 HTTPS → navegador / PWA
  - :8766 HTTP  → hook scripts del satélite Wyoming
"""
import json
import ssl
import subprocess
import threading
import queue
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent   # raíz del repo jota-display

PHONE_IP       = "192.168.1.129"
PHONE_ADB_PORT = 32906           # puerto TLS Wireless Debugging; puede cambiar al reiniciar
ADB_BIN        = "/usr/bin/adb"
ADB_TARGET     = f"{PHONE_IP}:{PHONE_ADB_PORT}"

STATE = {"state": "idle", "text": "", "ts": 0}
CLIENTS: list[queue.SimpleQueue] = []
CLIENTS_LOCK = threading.Lock()
AUTO_SLEEP_SECONDS = 8


# ---------------------------------------------------------------------------
# ADB
# ---------------------------------------------------------------------------

def adb(*args) -> bool:
    cmd = [ADB_BIN, "-s", ADB_TARGET] + list(args)
    result = subprocess.run(cmd, capture_output=True, timeout=5)
    return result.returncode == 0


def screen_wake():
    adb("shell", "input", "keyevent", "KEYCODE_WAKEUP")


def screen_sleep():
    adb("shell", "input", "keyevent", "KEYCODE_SLEEP")


def connect_adb():
    """Conecta/reconecta al teléfono por IP:puerto explícito."""
    result = subprocess.run(
        [ADB_BIN, "connect", ADB_TARGET],
        capture_output=True, text=True, timeout=10
    )
    ok = "connected" in result.stdout
    if ok:
        print(f"[adb] Conectado a {ADB_TARGET}")
    else:
        print(f"[adb] No se pudo conectar a {ADB_TARGET}: {result.stdout.strip()}")
    return ok


def adb_watchdog():
    """Hilo que mantiene la conexión ADB viva."""
    while True:
        connect_adb()
        time.sleep(120)  # re-verificar cada 2 min


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
    threading.Thread(target=adb_watchdog, daemon=True).start()

    # HTTPS para el browser (PWA requiere HTTPS para modo standalone)
    https_server = ThreadingHTTPServer(("0.0.0.0", 8443), Handler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain("/home/sito/kiosk_cert.pem", "/home/sito/kiosk_key.pem")
    https_server.socket = ctx.wrap_socket(https_server.socket, server_side=True)

    # HTTP para los hooks del teléfono (LAN interna, sin HTTPS)
    http_server = ThreadingHTTPServer(("0.0.0.0", 8766), Handler)

    threading.Thread(target=http_server.serve_forever, daemon=True).start()
    print("jota-display en https://0.0.0.0:8443/ y http://0.0.0.0:8766/")
    https_server.serve_forever()
