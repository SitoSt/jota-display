#!/data/data/com.termux/files/usr/bin/sh
curl -s -X POST http://localhost:8766/state \
  -H 'Content-Type: application/json' \
  -d '{"state":"listening","text":""}' &
