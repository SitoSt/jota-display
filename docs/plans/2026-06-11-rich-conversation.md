# RichConversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `Conversation.vue` por un sistema de chat con historial scrollable, bloques de contenido tipados por tipo, preparado para streaming, con controles de sesión y corrección del bug de desaparición brusca.

**Architecture:** `useChat.js` (composable singleton) escucha a `useVoice` y mantiene el historial de mensajes tipados en memoria. `RichConversation.vue` lo renderiza con auto-scroll inteligente. `SessionControls.vue` muestra el botón top-right contextual. La capa adaptadora entre el protocolo SSE y el modelo interno vive exclusivamente en `useChat.js`.

**Tech Stack:** Vue 3 Composition API, Vitest + @vue/test-utils, CSS custom properties.

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `src/composables/useChat.js` | **Crear** — composable singleton con modelo de sesión y mensajes |
| `tests/composables/useChat.test.js` | **Crear** — tests del composable |
| `src/components/chat/blocks/TextBlock.vue` | **Crear** — texto con cursor de streaming |
| `src/components/chat/blocks/ThinkingBlock.vue` | **Crear** — puntos animados |
| `src/components/chat/blocks/ToolBlock.vue` | **Crear** — placeholder tool call |
| `src/components/chat/blocks/MarkdownBlock.vue` | **Crear** — placeholder markdown |
| `src/components/chat/blocks/ImageBlock.vue` | **Crear** — placeholder imagen |
| `src/components/chat/blocks/CodeBlock.vue` | **Crear** — placeholder código |
| `src/components/chat/MessageBubble.vue` | **Crear** — burbuja de mensaje con bloques dinámicos |
| `src/components/chat/RichConversation.vue` | **Crear** — contenedor scrollable |
| `src/components/chat/SessionControls.vue` | **Crear** — botón top-right contextual |
| `src/views/MainView.vue` | **Modificar** — usar RichConversation + SessionControls |
| `src/components/Conversation.vue` | **Eliminar** |

---

## Task 1: useChat.js

**Files:**
- Create: `src/composables/useChat.js`
- Create: `tests/composables/useChat.test.js`

- [ ] **Escribir los tests que deben fallar**

Crear `tests/composables/useChat.test.js`:

```js
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
```

- [ ] **Verificar que los tests fallan**

```bash
npx vitest run tests/composables/useChat.test.js
```

Resultado esperado: todos los tests fallan con `Cannot find module '../../src/composables/useChat.js'`.

- [ ] **Crear `src/composables/useChat.js`**

```js
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
    if (lb?.type === 'text' && lb.streaming) { lb.content += text; return }
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
      isThinking.value = false
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
```

- [ ] **Verificar que los tests pasan**

```bash
npx vitest run tests/composables/useChat.test.js
```

Resultado esperado: todos los tests pasan.

- [ ] **Commit**

```bash
git add src/composables/useChat.js tests/composables/useChat.test.js
git commit -m "feat(chat): añadir useChat — historial de sesión y wiring con useVoice"
```

---

## Task 2: Block components

**Files:**
- Create: `src/components/chat/blocks/TextBlock.vue`
- Create: `src/components/chat/blocks/ThinkingBlock.vue`
- Create: `src/components/chat/blocks/ToolBlock.vue`
- Create: `src/components/chat/blocks/MarkdownBlock.vue`
- Create: `src/components/chat/blocks/ImageBlock.vue`
- Create: `src/components/chat/blocks/CodeBlock.vue`

- [ ] **Crear `src/components/chat/blocks/TextBlock.vue`**

```vue
<script setup>
defineProps({
  content:   { type: String,  default: '' },
  streaming: { type: Boolean, default: false },
})
</script>

<template>
  <p class="text-block">
    {{ content }}<span v-if="streaming" class="text-block__cursor" />
  </p>
</template>

<style scoped>
.text-block {
  font-size: clamp(1.4rem, 3.5vmin, 2rem);
  font-weight: 300;
  color: rgba(255,255,255,0.88);
  line-height: 1.45;
  margin: 0;
}

.text-block__cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: rgba(255,255,255,0.6);
  vertical-align: text-bottom;
  margin-left: 2px;
  animation: cursor-blink 1s step-end infinite;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
</style>
```

- [ ] **Crear `src/components/chat/blocks/ThinkingBlock.vue`**

```vue
<template>
  <div class="thinking-block">
    <span/><span/><span/>
  </div>
</template>

<style scoped>
.thinking-block {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem 0;
}
.thinking-block span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-2);
  animation: dot-pulse 1.4s ease-in-out infinite;
}
.thinking-block span:nth-child(2) { animation-delay: 0.2s; }
.thinking-block span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40%           { opacity: 1;    transform: scale(1); }
}
</style>
```

- [ ] **Crear `src/components/chat/blocks/ToolBlock.vue`**

```vue
<script setup>
defineProps({
  toolName:   { type: String, default: 'tool' },
  toolStatus: { type: String, default: 'running' },
})
</script>

<template>
  <div class="tool-block" :class="`tool-block--${toolStatus}`">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
    <span class="tool-block__name">{{ toolName }}</span>
    <span class="tool-block__status">{{ toolStatus }}</span>
  </div>
</template>

<style scoped>
.tool-block {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.09);
  background: rgba(255,255,255,0.03);
  width: fit-content;
  color: rgba(255,255,255,0.3);
}
.tool-block__name   { font-size: 0.72rem; font-family: monospace; color: rgba(255,255,255,0.5); }
.tool-block__status { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; }
.tool-block--running .tool-block__status { color: rgba(96,165,250,0.7); }
.tool-block--done    .tool-block__status { color: rgba(74,222,128,0.7); }
.tool-block--error   .tool-block__status { color: rgba(248,113,113,0.7); }
</style>
```

- [ ] **Crear `src/components/chat/blocks/MarkdownBlock.vue`**

```vue
<script setup>
defineProps({ content: { type: String, default: '' } })
</script>

<template>
  <div class="md-block">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
    <span>Markdown</span>
  </div>
</template>

<style scoped>
.md-block {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px dashed rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.22);
  font-size: 0.72rem;
  width: fit-content;
}
</style>
```

- [ ] **Crear `src/components/chat/blocks/ImageBlock.vue`**

```vue
<script setup>
defineProps({ content: { type: String, default: '' } })
</script>

<template>
  <div class="img-block">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
    <span>{{ content || 'imagen' }}</span>
  </div>
</template>

<style scoped>
.img-block {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px dashed rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.22);
  font-size: 0.72rem;
  width: fit-content;
}
</style>
```

- [ ] **Crear `src/components/chat/blocks/CodeBlock.vue`**

```vue
<script setup>
defineProps({
  content: { type: String, default: '' },
  lang:    { type: String, default: '' },
})
</script>

<template>
  <div class="code-block">
    <span v-if="lang" class="code-block__lang">{{ lang }}</span>
    <pre class="code-block__pre"><code>{{ content }}</code></pre>
  </div>
</template>

<style scoped>
.code-block {
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.09);
  background: rgba(0,0,0,0.3);
  overflow: hidden;
  max-width: 100%;
}
.code-block__lang {
  display: block;
  padding: 4px 12px;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.22);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.code-block__pre {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.6);
  font-family: monospace;
  line-height: 1.5;
}
</style>
```

- [ ] **Verificar que Vite compila sin errores**

```bash
npm run build 2>&1 | tail -5
```

Resultado esperado: `✓ built in ...ms` sin errores.

- [ ] **Commit**

```bash
git add src/components/chat/blocks/
git commit -m "feat(chat): bloques de contenido — TextBlock, ThinkingBlock y placeholders"
```

---

## Task 3: MessageBubble.vue

**Files:**
- Create: `src/components/chat/MessageBubble.vue`

- [ ] **Crear `src/components/chat/MessageBubble.vue`**

```vue
<script setup>
import TextBlock     from './blocks/TextBlock.vue'
import ThinkingBlock from './blocks/ThinkingBlock.vue'
import ToolBlock     from './blocks/ToolBlock.vue'
import MarkdownBlock from './blocks/MarkdownBlock.vue'
import ImageBlock    from './blocks/ImageBlock.vue'
import CodeBlock     from './blocks/CodeBlock.vue'

defineProps({
  message: { type: Object, required: true },
})

const BLOCK = {
  text:     TextBlock,
  thinking: ThinkingBlock,
  tool:     ToolBlock,
  markdown: MarkdownBlock,
  image:    ImageBlock,
  code:     CodeBlock,
}
</script>

<template>
  <div class="msg-bubble" :class="`msg-bubble--${message.role}`">
    <span class="msg-bubble__label">{{ message.role === 'user' ? 'tú' : 'jota' }}</span>
    <div class="msg-bubble__blocks">
      <component
        v-for="(block, i) in message.blocks"
        :key="i"
        :is="BLOCK[block.type] ?? TextBlock"
        v-bind="block"
      />
    </div>
  </div>
</template>

<style scoped>
.msg-bubble {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.msg-bubble__label {
  font-size: var(--text-sm);
  font-weight: var(--fw-medium);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
}

.msg-bubble__blocks {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.msg-bubble--user .msg-bubble__blocks {
  opacity: 0.5;
}
</style>
```

- [ ] **Verificar compilación**

```bash
npm run build 2>&1 | tail -5
```

Resultado esperado: `✓ built in ...ms`.

- [ ] **Commit**

```bash
git add src/components/chat/MessageBubble.vue
git commit -m "feat(chat): MessageBubble — burbuja con bloques dinámicos por tipo"
```

---

## Task 4: RichConversation.vue

**Files:**
- Create: `src/components/chat/RichConversation.vue`

- [ ] **Crear `src/components/chat/RichConversation.vue`**

```vue
<script setup>
import { ref, watch, nextTick } from 'vue'
import { useChat } from '../../composables/useChat.js'
import MessageBubble from './MessageBubble.vue'
import ThinkingBlock from './blocks/ThinkingBlock.vue'

const { session, isThinking } = useChat()

const scrollEl    = ref(null)
let userScrolled  = false

function onScroll() {
  if (!scrollEl.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollEl.value
  userScrolled = scrollHeight - scrollTop - clientHeight > 48
}

async function scrollToBottom() {
  if (userScrolled) return
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}

watch(() => session.value.messages.length, scrollToBottom)
watch(isThinking, (v) => { if (v) { userScrolled = false; scrollToBottom() } })
</script>

<template>
  <div class="rich-conv">
    <div class="rich-conv__scroll" ref="scrollEl" @scroll.passive="onScroll">
      <div class="rich-conv__messages">
        <Transition
          v-for="msg in session.messages"
          :key="msg.id"
          name="bubble"
          appear
        >
          <MessageBubble :message="msg" />
        </Transition>
        <Transition name="dots">
          <ThinkingBlock v-if="isThinking" />
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rich-conv {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}

/* Fade superior — indica que hay más mensajes arriba */
.rich-conv::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 64px;
  background: linear-gradient(to bottom, var(--bg), transparent);
  pointer-events: none;
  z-index: 1;
}

.rich-conv__scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: none;
}
.rich-conv__scroll::-webkit-scrollbar { display: none; }

.rich-conv__messages {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding: 64px 0 0.5rem;
}

.bubble-enter-active { transition: opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out); }
.bubble-leave-active { transition: opacity var(--dur-normal) var(--ease-in); }
.bubble-enter-from   { opacity: 0; transform: translateY(12px); }
.bubble-leave-to     { opacity: 0; }

.dots-enter-active, .dots-leave-active { transition: opacity var(--dur-normal) var(--ease-in-out); }
.dots-enter-from, .dots-leave-to       { opacity: 0; }
</style>
```

- [ ] **Verificar compilación**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add src/components/chat/RichConversation.vue
git commit -m "feat(chat): RichConversation — contenedor scrollable con auto-scroll inteligente"
```

---

## Task 5: SessionControls.vue

**Files:**
- Create: `src/components/chat/SessionControls.vue`

- [ ] **Crear `src/components/chat/SessionControls.vue`**

```vue
<script setup>
import { computed } from 'vue'
import { useChat } from '../../composables/useChat.js'

const { session, historyVisible, newSession, showHistory } = useChat()

const hasHistory      = computed(() => session.value.messages.length > 0)
const showNewBtn      = computed(() => historyVisible.value && hasHistory.value)
const showOpenBtn     = computed(() => !historyVisible.value && hasHistory.value)
</script>

<template>
  <div class="session-controls">
    <Transition name="ctrl-fade">
      <button
        v-if="showNewBtn"
        key="new"
        class="session-btn"
        @click="newSession"
        title="Nueva conversación"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
    </Transition>
    <Transition name="ctrl-fade">
      <button
        v-if="showOpenBtn"
        key="open"
        class="session-btn"
        @click="showHistory"
        title="Ver conversación"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.session-controls {
  position: absolute;
  top: calc(var(--strip-h, 54px) + 12px);
  right: 1rem;
  z-index: 5;
  display: flex;
  gap: 6px;
}

.session-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--dur-fast), color var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
}
.session-btn:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.7); }

.ctrl-fade-enter-active { transition: opacity var(--dur-fast) var(--ease-out); }
.ctrl-fade-leave-active { transition: opacity var(--dur-fast) var(--ease-in); }
.ctrl-fade-enter-from, .ctrl-fade-leave-to { opacity: 0; }
</style>
```

- [ ] **Verificar compilación**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add src/components/chat/SessionControls.vue
git commit -m "feat(chat): SessionControls — botón contextual nueva sesión / ver historial"
```

---

## Task 6: Wiring en MainView.vue + eliminar Conversation.vue

**Files:**
- Modify: `src/views/MainView.vue`
- Delete: `src/components/Conversation.vue`

- [ ] **Eliminar `src/components/Conversation.vue`**

```bash
git rm src/components/Conversation.vue
```

- [ ] **Reemplazar el contenido completo de `src/views/MainView.vue`**

```vue
<script setup>
import { watch, onMounted } from 'vue'
import { useVoice } from '../composables/useVoice.js'
import { useIdle } from '../composables/useIdle.js'
import { useLayout } from '../composables/useLayout.js'
import { useChat } from '../composables/useChat.js'
import { applyTheme } from '../composables/useTheme.js'
import IdleScreen        from '../components/IdleScreen.vue'
import VaporStrip        from '../components/VaporStrip.vue'
import RichConversation  from '../components/chat/RichConversation.vue'
import SessionControls   from '../components/chat/SessionControls.vue'
import WidgetGrid        from '../widgets/WidgetGrid.vue'

const { connectSSE, connectHA, current } = useVoice()
const { loadIdle, idleActive, startIdleTimer, dismissIdle } = useIdle()
const { loadLayout } = useLayout()
const { historyVisible } = useChat()

watch(current, (state) => {
  if (state !== 'idle') dismissIdle()
  else startIdleTimer()
})

onMounted(async () => {
  connectSSE()
  connectHA()
  await Promise.all([loadLayout(), loadIdle(), applyTheme()])
  if ('wakeLock' in navigator) {
    const req = () => navigator.wakeLock.request('screen').catch(() => {})
    req()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') req()
    })
  }
})
</script>

<template>
  <div class="main-view">
    <Transition name="screen-fade">
      <IdleScreen v-if="idleActive" @click="dismissIdle" />
    </Transition>

    <Transition name="screen-fade">
      <div v-if="!idleActive" class="home-layout">
        <VaporStrip />
        <SessionControls />
        <div class="content-area">
          <Transition name="content-fade">
            <RichConversation v-if="historyVisible" class="content-area__transcript" />
          </Transition>
          <WidgetGrid />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.main-view {
  position: absolute;
  inset: 0;
}
</style>
```

- [ ] **Verificar que no hay errores de compilación**

```bash
npm run build 2>&1 | tail -8
```

Resultado esperado: `✓ built in ...ms` sin errores.

- [ ] **Ejecutar todos los tests**

```bash
npm test 2>&1 | grep -E "Tests|failed|passed" | tail -4
```

Resultado esperado: los mismos 8 tests que fallaban antes siguen fallando (son pre-existentes), el resto pasa. Los nuevos tests de useChat deben pasar.

- [ ] **Commit final**

```bash
git add src/views/MainView.vue
git commit -m "feat(chat): conectar RichConversation en MainView, eliminar Conversation.vue"
```
