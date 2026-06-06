import { describe, it, expect, beforeEach, vi } from 'vitest'

// useVoice usa refs singleton a nivel de módulo.
// Los reseteamos entre tests reimportando el módulo limpio.
async function freshVoice() {
  vi.resetModules()
  // Silenciar el EventSource que intenta conectar en connectSSE
  globalThis.EventSource = vi.fn(() => ({ onmessage: null, onerror: null, close: vi.fn() }))
  const mod = await import('../../src/composables/useVoice.js')
  return mod
}

describe('applyEvent — máquina de estados', () => {
  let applyEvent, useVoice

  beforeEach(async () => {
    ;({ applyEvent, useVoice } = await freshVoice())
  })

  it('estado inicial es idle con refs vacías', () => {
    const { current, transcript, response } = useVoice()
    expect(current.value).toBe('idle')
    expect(transcript.value).toBe('')
    expect(response.value).toBe('')
  })

  it('listening solo cambia current', () => {
    const { current, transcript } = useVoice()
    applyEvent({ state: 'listening' })
    expect(current.value).toBe('listening')
    expect(transcript.value).toBe('')
  })

  it('thinking actualiza current y transcript', () => {
    const { current, transcript } = useVoice()
    applyEvent({ state: 'thinking', text: 'qué temperatura hay' })
    expect(current.value).toBe('thinking')
    expect(transcript.value).toBe('qué temperatura hay')
  })

  it('thinking sin text no borra transcript previo', () => {
    const { current, transcript } = useVoice()
    applyEvent({ state: 'thinking', text: 'pregunta anterior' })
    applyEvent({ state: 'thinking' })
    expect(transcript.value).toBe('pregunta anterior')
  })

  it('response actualiza current y response', () => {
    const { current, response } = useVoice()
    applyEvent({ state: 'response', text: 'Hay 21 grados.' })
    expect(current.value).toBe('response')
    expect(response.value).toBe('Hay 21 grados.')
  })

  it('response limpia response anterior antes de asignar', () => {
    const { response: resp } = useVoice()
    applyEvent({ state: 'thinking', text: 'pregunta' })
    applyEvent({ state: 'response', text: 'respuesta 1' })
    applyEvent({ state: 'thinking', text: 'otra pregunta' })
    // al volver a thinking, response se limpia
    expect(resp.value).toBe('')
  })

  it('idle limpia todo', () => {
    const { current, transcript, response } = useVoice()
    applyEvent({ state: 'thinking', text: 'algo' })
    applyEvent({ state: 'response', text: 'respuesta' })
    applyEvent({ state: 'idle' })
    expect(current.value).toBe('idle')
    expect(transcript.value).toBe('')
    expect(response.value).toBe('')
  })

  it('ciclo completo: idle → listening → thinking → response → idle', () => {
    const { current, transcript, response } = useVoice()
    applyEvent({ state: 'listening' })
    expect(current.value).toBe('listening')
    applyEvent({ state: 'thinking', text: 'cuántos grados hay' })
    expect(transcript.value).toBe('cuántos grados hay')
    applyEvent({ state: 'response', text: '21 grados.' })
    expect(response.value).toBe('21 grados.')
    applyEvent({ state: 'idle' })
    expect(current.value).toBe('idle')
    expect(transcript.value).toBe('')
    expect(response.value).toBe('')
  })

  it('evento desconocido no cambia el estado', () => {
    const { current } = useVoice()
    applyEvent({ state: 'listening' })
    applyEvent({ state: 'fantasma' })
    expect(current.value).toBe('listening')
  })

  it('evento sin state cae a idle', () => {
    const { current } = useVoice()
    applyEvent({ state: 'listening' })
    applyEvent({})
    expect(current.value).toBe('idle')
  })
})
