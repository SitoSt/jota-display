# RichConversation — Diseño

**Fecha:** 2026-06-11
**Estado:** Aprobado

## Objetivo

Reemplazar `Conversation.vue` por un sistema de chat con historial scrollable, bloques de contenido tipados y preparado para streaming y tipos de contenido ricos (tool calls, markdown, imágenes, código). Incluye corrección del bug de desaparición brusca de conversación y controles de sesión.

---

## Arquitectura

Dos capas independientes:

- **`useVoice.js`** — sin cambios. Sigue siendo la fuente de verdad del estado de voz (idle / listening / thinking / response) y del texto plano que llega por SSE.
- **`useChat.js`** — nuevo composable. Escucha a `useVoice` y construye el historial de mensajes tipados. Contiene la capa adaptadora: cuando J-Voice cambie el formato de envío, solo se modifica este fichero.

Los componentes de UI viven en `src/components/chat/` y no conocen el protocolo de red.

---

## Modelo de datos

```js
// Bloque de contenido dentro de un mensaje
ContentBlock {
  type: 'text' | 'thinking' | 'tool' | 'markdown' | 'image' | 'code'
  content: string       // texto, url, código fuente…
  streaming: boolean    // true mientras llegan tokens
  toolName?: string     // solo type:'tool'
  toolStatus?: 'running' | 'done' | 'error'
  lang?: string         // solo type:'code'
}

// Mensaje en el historial
Message {
  id: string            // nanoid corto
  role: 'user' | 'assistant'
  blocks: ContentBlock[]
  timestamp: number
}

// Sesión de conversación (vive en memoria, no se persiste)
Session {
  id: string
  messages: Message[]
  startedAt: number
}
```

`useChat` expone:
```js
{
  session,          // Session reactive
  historyVisible,   // boolean — si el panel está visible
  appendToken,      // (role, text) → añade token al último bloque text en streaming
  pushMessage,      // (role, blocks) → añade mensaje completo
  newSession,       // () → descarta sesión actual, crea nueva vacía
  showHistory,      // () → historyVisible = true
  hideHistory,      // () → historyVisible = false
}
```

---

## Componentes

```
src/components/chat/
  RichConversation.vue      ← contenedor: scroll, fade superior, auto-scroll inteligente
  SessionControls.vue       ← botón top-right contextual
  MessageBubble.vue         ← burbuja completa (user o assistant)
  blocks/
    TextBlock.vue           ← texto plano con cursor de streaming
    ThinkingBlock.vue       ← tres puntos animados
    ToolBlock.vue           ← placeholder: nombre + spinner/check
    MarkdownBlock.vue       ← placeholder: borde + icono
    ImageBlock.vue          ← placeholder: icono + nombre
    CodeBlock.vue           ← placeholder: caja monoespaciada
```

`RichConversation.vue` hace auto-scroll al último mensaje cuando llega contenido nuevo, **excepto** si el usuario ha scrolleado manualmente hacia arriba (flag interno `userScrolled`).

Los bloques placeholder muestran un mínimo visual (borde, icono, tipo) para que el layout no salte cuando llegue contenido real en el futuro.

---

## UX y sesión

### Visibilidad del panel
| Estado | Comportamiento |
|--------|----------------|
| Voz activa (listening / thinking / response) | Panel visible automáticamente |
| Vuelta a `idle` | Panel se mantiene visible **4 segundos**, luego se oculta |
| Usuario pulsa VaporStrip estando oculto | Inicia escucha + muestra panel |
| Usuario pulsa "Ver conversación" | Muestra panel sin iniciar escucha |

### Botón top-right (`SessionControls.vue`)
| Estado | Botón visible |
|--------|--------------|
| Panel visible | "Nueva sesión" (icono refresh pequeño) |
| Panel oculto + hay historial | "Ver conversación" (icono chat) |
| Panel oculto + sin historial | Sin botón |

El botón "Cerrar conversación" se omite en esta fase.

### Sesión
- El historial vive solo en memoria (no persiste entre recargas).
- "Nueva sesión" crea un `Session` nuevo vacío y descarta el anterior.
- La gestión automática de sesiones largas (crear nueva si la sesión es muy larga) queda para J-Display o J-Voice en fases posteriores.

---

## Bugs corregidos en este scope

| Bug | Causa actual | Solución |
|-----|-------------|----------|
| Conversación desaparece a mitad | `useVoice` borra `transcript`/`response` inmediatamente al llegar `idle` | `useChat` mantiene el historial; el panel espera 4s antes de ocultarse |
| Contenido parpadea al cambiar estado | El componente actual desmonta/monta el texto | `useChat` acumula; el componente solo añade bloques, nunca borra |

## Fuera de scope

- **Streaming real de tokens**: la infraestructura SSE de J-Voice aún no lo emite. `useChat` está preparado (`appendToken`, flag `streaming`) pero no se activará hasta que J-Voice lo envíe.
- **Cancel pipeline**: requiere endpoint en J-Voice. Se anota como deuda técnica.
- **Sincronización audio-subtítulos**: depende de investigar formato TTS con timestamps.
- **Persistencia de historial**: fuera de scope, memoria únicamente.
- **Renderizado real de markdown, imágenes, código**: los bloques existen como placeholders; el render real es trabajo futuro.
