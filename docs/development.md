# Guía de desarrollo y testing

---

## Arrancar el entorno local

```bash
npm run dev:full
```

Arranca los dos procesos necesarios de una vez:
- **Python server** en `:8766` — SSE, `/state`, `/config`, `/dev/ha-state`
- **Vite** en `:5173` — UI con hot reload

Si alguno de los puertos ya estaba ocupado (proceso anterior no cerrado limpiamente), el script los libera antes de arrancar.

Una vez en marcha, abre `http://localhost:5173` en el navegador.

Para parar: `Ctrl+C`.

---

## Simular eventos de voz

El script `scripts/sim.sh` envía eventos al servidor sin necesidad de hablar ni de tener wyoming corriendo.

### Estados individuales

```bash
./scripts/sim.sh idle
./scripts/sim.sh listening
./scripts/sim.sh thinking "qué temperatura hay"
./scripts/sim.sh response "Ahora mismo hay 21 grados."
```

### Escenarios

```bash
# Ciclo completo realista (listening → thinking → response → auto-idle a los 8s)
./scripts/sim.sh conversation

# Ciclo con texto personalizado
./scripts/sim.sh conversation "pon las luces" "Listo, luces al 50%."

# Ciclo rápido sin esperas (útil para iterar visualmente)
./scripts/sim.sh quick

# Bucle continuo cada N segundos (Ctrl+C para parar)
./scripts/sim.sh loop
./scripts/sim.sh loop 5

# Transiciones muy rápidas para detectar bugs visuales o flickering
./scripts/sim.sh stress
```

### Contra el dispositivo físico

```bash
JOTA_SERVER=http://192.168.1.129:8766 ./scripts/sim.sh conversation
```

---

## Test visual interactivo

Recorre todos los estados en orden con texto de ejemplo, para inspección visual completa.

```bash
# Automático: cada estado dura unos segundos
./scripts/test-visual.sh

# Paso a paso: tú controlas el ritmo con Enter
./scripts/test-visual.sh --step
```

Secuencia: `idle` → `listening` → `thinking` → `response` → `idle` → stress test rápido.

---

## Tests automáticos

### Frontend (Vitest)

Testea la máquina de estados de `useVoice.js` — transiciones, limpieza de refs, casos límite.

```bash
npm test              # ejecución única
npm run test:watch    # modo watch (se re-ejecuta al guardar)
```

Tests actuales (`tests/composables/useVoice.test.js`):
- Estado inicial correcto
- `listening` solo cambia `current`
- `thinking` actualiza `current` y `transcript`
- `thinking` sin texto no borra transcript anterior
- `response` actualiza `current` y `response`
- `response` → `thinking` limpia `response`
- `idle` limpia todo
- Ciclo completo listening → thinking → response → idle
- Evento desconocido no cambia el estado
- Evento sin `state` cae a `idle`

### Backend (pytest)

Testea la lógica del servidor Python sin arrancar el servidor HTTP.

```bash
python3 -m pytest server/tests/ -v
```

Tests actuales (`server/tests/test_server.py`):
- `broadcast` actualiza `STATE` y `ts`
- `broadcast` envía mensajes a todos los clientes conectados
- `broadcast` elimina clientes con conexión muerta
- `schedule_sleep` vuelve a `idle` tras el delay
- `schedule_sleep` no actúa si el estado cambió antes del delay
- `schedule_sleep` no actúa si el estado no es `response`
- Persistencia de texto en `thinking` y `response`

---

## Datos de prueba para widgets HA (futuro)

Cuando se construyan los widgets de Home Assistant, el servidor puede devolver
datos de prueba en lugar de conectar a HA real. Activa el modo desarrollo:

```bash
# En .env (dispositivo) o como variable inline:
JOTA_DEV=true python3 server/server.py
```

Con `JOTA_DEV=true`, el endpoint `GET /dev/ha-state` devuelve el fichero
`dev/fixtures/ha-state.json`, que contiene entidades de ejemplo:
climate, light, cover, sensor y media_player.

Edita `dev/fixtures/ha-state.json` para ajustar los valores que quieres
ver en la UI sin necesidad de tener HA corriendo.

---

## Referencia rápida

| Qué quiero hacer | Comando |
|---|---|
| Arrancar entorno completo | `npm run dev:full` |
| Solo Vite (sin servidor Python) | `npm run dev` |
| Simular conversación | `./scripts/sim.sh conversation` |
| Simular en bucle | `./scripts/sim.sh loop` |
| Ver todos los estados a mano | `./scripts/test-visual.sh --step` |
| Tests frontend | `npm test` |
| Tests backend | `python3 -m pytest server/tests/ -v` |
| Tests en watch mode | `npm run test:watch` |
| Simular contra el móvil | `JOTA_SERVER=http://192.168.1.129:8766 ./scripts/sim.sh conversation` |
