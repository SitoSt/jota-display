"""
Tests unitarios del servidor jota-display.
Ejecutar: python3 -m pytest server/tests/ -v
No requieren arrancar el servidor — testean la lógica pura.
"""
import json
import queue
import threading
import time
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Parchear las variables de entorno antes de importar server
os.environ.setdefault('JOTA_FULLY_PASSWORD', 'test')

import importlib
import server as srv

# ── Helpers ───────────────────────────────────────────────────────────────────

def reset_state():
    srv.STATE.update({'state': 'idle', 'text': '', 'ts': 0})
    with srv.CLIENTS_LOCK:
        srv.CLIENTS.clear()


# ── Tests: broadcast ──────────────────────────────────────────────────────────

class TestBroadcast:
    def setup_method(self):
        reset_state()

    def test_broadcast_actualiza_state(self):
        srv.broadcast({'state': 'listening', 'text': ''})
        assert srv.STATE['state'] == 'listening'

    def test_broadcast_actualiza_ts(self):
        before = time.time()
        srv.broadcast({'state': 'thinking', 'text': 'algo'})
        assert srv.STATE['ts'] >= before

    def test_broadcast_envia_a_clientes(self):
        q = queue.SimpleQueue()
        with srv.CLIENTS_LOCK:
            srv.CLIENTS.append(q)
        srv.broadcast({'state': 'response', 'text': 'hola'})
        msg = q.get(timeout=1)
        data = json.loads(msg.replace('data: ', '').strip())
        assert data['state'] == 'response'
        assert data['text'] == 'hola'

    def test_broadcast_elimina_clientes_muertos(self):
        class DeadQueue:
            def put_nowait(self, _):
                raise Exception('muerto')

        with srv.CLIENTS_LOCK:
            srv.CLIENTS.append(DeadQueue())

        srv.broadcast({'state': 'idle', 'text': ''})

        with srv.CLIENTS_LOCK:
            assert len(srv.CLIENTS) == 0

    def test_broadcast_multiples_clientes(self):
        queues = [queue.SimpleQueue() for _ in range(3)]
        with srv.CLIENTS_LOCK:
            srv.CLIENTS.extend(queues)
        srv.broadcast({'state': 'listening', 'text': ''})
        for q in queues:
            msg = q.get(timeout=1)
            assert 'listening' in msg


# ── Tests: schedule_sleep ─────────────────────────────────────────────────────

class TestScheduleSleep:
    def setup_method(self):
        reset_state()

    def test_vuelve_a_idle_tras_delay(self):
        srv.broadcast({'state': 'response', 'text': 'ok'})
        srv.schedule_sleep(0.1)
        time.sleep(0.3)
        assert srv.STATE['state'] == 'idle'

    def test_no_duerme_si_estado_cambia(self):
        """Si el estado cambia antes del delay, no vuelve a idle."""
        srv.broadcast({'state': 'response', 'text': 'ok'})
        srv.schedule_sleep(0.2)
        # Cambiar estado antes de que expire el sleep
        time.sleep(0.05)
        srv.broadcast({'state': 'listening', 'text': ''})
        time.sleep(0.3)
        # No debe haberse vuelto a idle por el schedule_sleep anterior
        assert srv.STATE['state'] == 'listening'

    def test_no_duerme_si_estado_no_es_response(self):
        """schedule_sleep solo actúa si el estado sigue siendo response."""
        srv.broadcast({'state': 'thinking', 'text': 'algo'})
        srv.schedule_sleep(0.1)
        time.sleep(0.3)
        assert srv.STATE['state'] == 'thinking'


# ── Tests: lógica de /state ───────────────────────────────────────────────────

class TestStateLogic:
    def setup_method(self):
        reset_state()

    def test_estado_idle_se_persiste(self):
        srv.broadcast({'state': 'idle', 'text': ''})
        assert srv.STATE['state'] == 'idle'
        assert srv.STATE['text'] == ''

    def test_texto_se_guarda_en_thinking(self):
        srv.broadcast({'state': 'thinking', 'text': 'qué hora es'})
        assert srv.STATE['text'] == 'qué hora es'

    def test_texto_se_guarda_en_response(self):
        srv.broadcast({'state': 'response', 'text': 'Son las 10:00.'})
        assert srv.STATE['text'] == 'Son las 10:00.'
