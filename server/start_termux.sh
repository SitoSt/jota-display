#!/data/data/com.termux/files/usr/bin/sh
# Arranca jota-display en modo Termux.
# Coloca este script (o un enlace) en ~/.termux/boot/ para que arranque solo.

export JOTA_MODE=termux
export JOTA_ADB_PORT=32906   # actualizar si cambia tras reinicio del teléfono

cd ~/jota-display
exec python3 server/server.py >> ~/jota-display.log 2>&1
