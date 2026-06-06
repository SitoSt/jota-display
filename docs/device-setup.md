# Configuración del dispositivo — Huawei P8 Lite

Guía de instalación y operación del dispositivo que actúa como terminal de voz.
Aplica a cualquier Android con Termux, adaptando las rutas si es necesario.

---

## Arquitectura del dispositivo

```
Huawei P8 Lite (192.168.1.129)
│
├── Fully Kiosk Browser (app)
│     ├── WebView → http://localhost:8766/
│     ├── Landscape forzado, pantalla completa
│     └── API REST :2323 → recibe wake/sleep del servidor
│
└── Termux
      ├── wyoming-satellite    :10700  (satélite Wyoming)
      ├── wyoming-openwakeword :10401  (wake word local)
      └── jota-display server  :8766   (UI + SSE)
```

Los hook scripts del satélite hacen POST a `http://localhost:8766/state`
para notificar cambios de estado al servidor, que los reenvía via SSE al navegador.

---

## Instalación inicial

### 1. Termux

Instalar desde F-Droid (no Play Store, la versión de Play Store está desactualizada):
```bash
pkg update && pkg upgrade
pkg install python sox rsync
```

### 2. wyoming-satellite

```bash
cd ~
git clone https://github.com/rhasspy/wyoming-satellite
cd wyoming-satellite
python3 -m venv .venv
.venv/bin/pip install -e '.[all]'
```

Ver `docs/phone-patches.md` para los parches requeridos post-instalación.

### 3. wyoming-openwakeword

El entorno virtual debe crearse con `--system-site-packages` para heredar
numpy y tflite-runtime del sistema Termux (compilarlos desde source tarda horas en ARM):

```bash
python3 -m venv ~/oww-venv --system-site-packages
~/oww-venv/bin/pip install --no-deps wyoming-openwakeword
~/oww-venv/bin/pip install 'wyoming==1.5.4'
```

Aplicar el parche de `handler.py` (ver `docs/phone-patches.md` sección 2).

### 4. jota-display

```bash
# Clonar el repo
git clone https://github.com/SitoSt/jota-display ~/jota-display

# Dar permisos a los scripts
chmod +x ~/jota-display/hooks/*.sh
chmod +x ~/jota-display/server/start_termux.sh
```

### 5. Fully Kiosk Browser

Instalar desde Google Play: buscar **"Fully Kiosk Browser"** (ID: `de.ozerov.fully`).

Configuración en Fully Kiosk:
- Start URL: `http://localhost:8766/`
- Remote Administration: **activado**, puerto `2323`, contraseña configurada
- Device Admin: **activado** (para control de pantalla)
- Fullscreen Mode: **activado**

Ver `docs/superpowers/plans/2026-05-28-fase-1-fully-kiosk.md` para el proceso completo paso a paso.

---

## Arranque manual (orden obligatorio)

```bash
# 1. Openwakeword (esperar ~15s a que cargue el modelo TFLite)
nohup ~/oww-venv/bin/python3 -m wyoming_openwakeword \
  --uri tcp://0.0.0.0:10401 \
  --preload-model ok_nabu \
  --threshold 0.3 \
  > ~/oww.log 2>&1 &

# Verificar que cargó:
tail -f ~/oww.log  # esperar: "Created TensorFlow Lite XNNPACK delegate for CPU"

# 2. Satélite Wyoming
nohup sh ~/start-satellite.sh </dev/null >/dev/null 2>&1 &

# 3. jota-display server
nohup sh ~/jota-display/server/start_termux.sh </dev/null >/dev/null 2>&1 &
```

---

## Boot automático (Termux:Boot)

Requiere la app **Termux:Boot** instalada desde F-Droid.

Los scripts en `~/.termux/boot/` se ejecutan al iniciar Termux:

```
~/.termux/boot/
├── start-jota.sh          ← enlace a server/start_termux.sh
└── wyoming-satellite-android  ← arranca el satélite
```

**openwakeword no tiene boot automático todavía** — requiere arranque manual
(ver pendientes en `docs/SPEC.md`).

---

## Diagnóstico rápido

```bash
# ¿Están corriendo los procesos?
ps aux | grep -E "wyoming|openwake|server.py" | grep -v grep

# Logs
tail -f ~/wyoming-satellite.log
tail -f ~/oww.log
tail -f ~/jota-display.log

# ¿Responde el servidor?
curl http://localhost:8766/

# ¿Estado actual via SSE?
curl http://localhost:8766/events

# ¿Fully Kiosk API responde?
curl "http://localhost:2323/?cmd=deviceInfo&type=json&password=<pass>"

# ¿Openwakeword responde?
nc -z -w 2 localhost 10401 && echo "OK" || echo "CAÍDO"

# Simular eventos (testing sin hablar)
curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"listening"}'

curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"thinking","text":"qué tiempo hace"}'

curl -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"response","text":"Hoy está nublado con 18 grados."}'
```
