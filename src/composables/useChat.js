import { ref, watch, readonly } from 'vue'
import { useVoice } from './useVoice.js'

function makeSession() {
  return { id: crypto.randomUUID(), messages: [], startedAt: Date.now() }
}

function makeMsg(role, blocks) {
  return { id: Math.random().toString(36).slice(2, 10), role, blocks, timestamp: Date.now() }
}

const session        = ref(makeSession())
const historyVisible = ref(false)
const isThinking     = ref(false)
let _hideTimer = null
let _wired     = false

function _clearTimer() {
  if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null }
}

function newSession() {
  _clearTimer()
  isThinking.value = false
  session.value = makeSession()
  historyVisible.value = false
}

function showHistory() {
  _clearTimer()
  historyVisible.value = true
}

function hideHistory() {
  _clearTimer()
  historyVisible.value = false
}

function pushMessage(role, blocks) {
  session.value.messages.push(makeMsg(role, blocks))
}

function appendToken(role, text) {
  const msgs = session.value.messages
  const last = msgs[msgs.length - 1]
  if (last?.role === role) {
    const lb = last.blocks[last.blocks.length - 1]
    if (lb?.type === 'text' && lb.streaming) {
      last.blocks[last.blocks.length - 1] = { ...lb, content: lb.content + text }
      return
    }
    last.blocks.push({ type: 'text', content: text, streaming: true })
    return
  }
  msgs.push(makeMsg(role, [{ type: 'text', content: text, streaming: true }]))
}

function _wireVoice() {
  if (_wired) return
  _wired = true
  const { current, transcript, response } = useVoice()

  watch(current, (newSt, oldSt) => {
    if (newSt !== 'idle') {
      _clearTimer()
      historyVisible.value = true
    }

    isThinking.value = newSt === 'thinking'

    if (newSt === 'thinking' && transcript.value) {
      pushMessage('user', [{ type: 'text', content: transcript.value, streaming: false }])
    }

    if (newSt === 'response' && response.value) {
      pushMessage('assistant', [{ type: 'text', content: response.value, streaming: false }])
    }

    if (newSt === 'idle' && oldSt !== 'idle') {
      _hideTimer = setTimeout(() => {
        historyVisible.value = false
        _hideTimer = null
      }, 4000)
    }
  })
}

export function useChat() {
  _wireVoice()
  return {
    session:        readonly(session),
    historyVisible: readonly(historyVisible),
    isThinking:     readonly(isThinking),
    pushMessage,
    appendToken,
    newSession,
    showHistory,
    hideHistory,
  }
}
