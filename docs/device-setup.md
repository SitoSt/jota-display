# Configuración del dispositivo — Huawei P8 Lite

Guía de instalación y operación del dispositivo que actúa como terminal de voz.
Aplica a cualquier Android con Termux, adaptando las rutas si es necesario.

---

## Arquitectura del dispositivo

```
Huawei P8 Lite (192.168.1.129)
│
├── WallPanel (app)
│     ├── WebView → http://localhost:8766/
│     ├── Landscape forzado, pantalla completa
│     └── API REST :2971 → recibe wake/sleep del servidor
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
pkg install python sox android-tools rsync
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

# Configurar ADB (para control de pantalla)
mkdir -p ~/.android
# Copiar adbkey y adbkey.pub desde el Mac (ver sección ADB)
adb connect localhost:32906
```

### 5. WallPanel

Descargar el APK del fork `thecowan`:
https://github.com/thecowan/wallpanel-android/releases

Instalar via ADB desde el Mac:
```bash
adb -s 192.168.1.129:32906 install wallpanel.apk
```

Configuración en WallPanel:
- Dashboard URL: `http://localhost:8766/`
- HTTP Server: **activado**, puerto `2971`
- Desactivar auto-rotate en Android (Ajustes → Pantalla)

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
JOTA_MODE=termux JOTA_ADB_PORT=32906 \
  nohup python3 ~/jota-display/server/server.py \
  >> ~/jota-display.log 2>&1 &
```

---

## Boot automático (Termux:Boot)

Requiere la app **Termux:Boot** instalada desde F-Droid.

Los scripts en `~/.termux/boot/` se ejecutan al iniciar Termux:

```
~/.termux/boot/
├── jota-display    ← ya configurado por el servidor
└── wyoming-satellite-android  ← arranca el satélite
```

**openwakeword no tiene boot automático todavía** — requiere arranque manual
(ver pendientes en `docs/SPEC.md`).

---

## ADB WiFi desde el Mac / worker-01

**Puerto de conexión:** `192.168.1.129:32906`

El puerto TLS de Wireless Debugging es estable mientras el ajuste esté activo.
Puede cambiar al reiniciar el teléfono — verificar en:
Ajustes → Opciones de desarrollador → Depuración inalámbrica.

```bash
# Conectar desde el Mac
adb connect 192.168.1.129:32906

# Comandos útiles
adb -s 192.168.1.129:32906 shell input keyevent KEYCODE_WAKEUP
adb -s 192.168.1.129:32906 shell input keyevent KEYCODE_SLEEP
adb -s 192.168.1.129:32906 logcat -s WallPanel  # logs de WallPanel
```

Para que **Termux ADB** use las mismas claves ya autorizadas por el teléfono,
copiar `~/.android/adbkey` y `~/.android/adbkey.pub` del Mac a
`~/.android/` en Termux (ya hecho en la instalación actual).

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

# ¿WallPanel API responde?
curl http://localhost:2971/api/state

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
