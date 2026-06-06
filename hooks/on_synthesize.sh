#!/data/data/com.termux/files/usr/bin/sh
TEXT="$1"
PAYLOAD=$(printf '{"state":"response","text":"%s"}' "$(echo "$TEXT" | sed 's/"/\\"/g')")
curl -s -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" &
