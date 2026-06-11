import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'

let mockCurrent, mockTranscript, mockResponse

async function freshChat() {
  vi.resetModules()
  mockCurrent    = ref('idle')
  mockTranscript = ref('')
  mockResponse   = ref('')

  vi.doMock('../../src/composables/useVoice.js', () => ({
    useVoice: () => ({
      current:      mockCurrent,
      transcript:   mockTranscript,
      response:     mockResponse,
      connectSSE:   vi.fn(),
      connectHA:    vi.fn(),
      cancel:       vi.fn(),
      startListening: vi.fn(),
    }),
  }))

  return import('../../src/composables/useChat.js')
}

describe('useChat — sesión', () => {
  afterEach(() => vi.restoreAllMocks())

  it('empieza con sesión vacía e historial oculto', async () => {
    const { useChat } = await freshChat()
    const { session, historyVisible } = useChat()
    expect(session.value.messages).toHaveLength(0)
    expect(historyVisible.value).toBe(false)
  })

  it('pushMessage añade mensaje a la sesión', async () => {
    const { useChat } = await freshChat()
    const { session, pushMessage } = useChat()
    pushMessage('user', [{ type: 'text', content: 'hola', streaming: false }])
    expect(session.value.messages).toHaveLength(1)
    expect(session.value.messages[0].role).toBe('user')
    expect(session.value.messages[0].blocks[0].content).toBe('hola')
  })

  it('newSession limpia mensajes y oculta historial', async () => {
    const { useChat } = await freshChat()
    const { session, historyVisible, pushMessage, newSession } = useChat()
    pushMessage('user', [{ type: 'text', content: 'algo', streaming: false }])
    newSession()
    expect(session.value.messages).toHaveLength(0)
    expect(historyVisible.value).toBe(false)
  })

  it('appendToken crea mensaje nuevo si no hay uno del rol', async () => {
    const { useChat } = await freshChat()
    const { session, appendToken } = useChat()
    appendToken('assistant', 'Hola')
    expect(session.value.messages).toHaveLength(1)
    expect(session.value.messages[0].blocks[0].content).toBe('Hola')
    expect(session.value.messages[0].blocks[0].streaming).toBe(true)
  })

  it('appendToken acumula tokens en el último bloque streaming', async () => {
    const { useChat } = await freshChat()
    const { session, appendToken } = useChat()
    appendToken('assistant', 'Ho')
    appendToken('assistant', 'la')
    expect(session.value.messages).toHaveLength(1)
    expect(session.value.messages[0].blocks[0].content).toBe('Hola')
  })

  it('showHistory y hideHistory cambian historyVisible', async () => {
    const { useChat } = await freshChat()
    const { historyVisible, showHistory, hideHistory } = useChat()
    showHistory()
    expect(historyVisible.value).toBe(true)
    hideHistory()
    expect(historyVisible.value).toBe(false)
  })
})

describe('useChat — integración con voz', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('muestra historial cuando current cambia a listening', async () => {
    const { useChat } = await freshChat()
    const { historyVisible } = useChat()
    mockCurrent.value = 'listening'
    await nextTick()
    expect(historyVisible.value).toBe(true)
  })

  it('añade mensaje de usuario al entrar en thinking', async () => {
    const { useChat } = await freshChat()
    const { session } = useChat()
    mockTranscript.value = 'qué temperatura hay'
    mockCurrent.value = 'thinking'
    await nextTick()
    expect(session.value.messages).toHaveLength(1)
    expect(session.value.messages[0].role).toBe('user')
    expect(session.value.messages[0].blocks[0].content).toBe('qué temperatura hay')
  })

  it('isThinking es true durante thinking y false en response', async () => {
    const { useChat } = await freshChat()
    const { isThinking } = useChat()
    mockTranscript.value = 'algo'
    mockCurrent.value = 'thinking'
    await nextTick()
    expect(isThinking.value).toBe(true)
    mockResponse.value = 'Respuesta.'
    mockCurrent.value = 'response'
    await nextTick()
    expect(isThinking.value).toBe(false)
  })

  it('añade mensaje de asistente al entrar en response', async () => {
    const { useChat } = await freshChat()
    const { session } = useChat()
    mockTranscript.value = 'qué temperatura hay'
    mockCurrent.value = 'thinking'
    await nextTick()
    mockResponse.value = 'Hay 21 grados.'
    mockCurrent.value = 'response'
    await nextTick()
    expect(session.value.messages).toHaveLength(2)
    expect(session.value.messages[1].role).toBe('assistant')
    expect(session.value.messages[1].blocks[0].content).toBe('Hay 21 grados.')
  })

  it('oculta historial 4s después de idle', async () => {
    vi.useFakeTimers()
    const { useChat } = await freshChat()
    const { historyVisible } = useChat()
    mockCurrent.value = 'listening'
    await nextTick()
    expect(historyVisible.value).toBe(true)
    mockCurrent.value = 'idle'
    await nextTick()
    expect(historyVisible.value).toBe(true)
    vi.advanceTimersByTime(4000)
    expect(historyVisible.value).toBe(false)
  })

  it('historyVisible permanece visible si vuelve a estar activo antes de los 4s', async () => {
    vi.useFakeTimers()
    const { useChat } = await freshChat()
    const { historyVisible } = useChat()
    mockCurrent.value = 'listening'
    await nextTick()
    mockCurrent.value = 'idle'
    await nextTick()
    vi.advanceTimersByTime(2000)
    mockCurrent.value = 'listening' // actividad antes de los 4s
    await nextTick()
    vi.advanceTimersByTime(4000)
    expect(historyVisible.value).toBe(true) // timer cancelado
  })
})
