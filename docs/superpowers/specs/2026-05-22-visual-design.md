# jota-display — SPEC: Diseño Visual

> Versión 0.1 — diseño visual
> Estado: en desarrollo

---

## 1. Filosofía de diseño

**Referencia:** Elegancia Apple — mínima, informativa, sin ruido. Cada elemento tiene razón de existir.

**Principios:**
- Minimalismo funcional: no hay elementos decorativos sin propósito
- Información visible pero no intrusiva — la interfaz se adapta al contexto
- Color como señal y jerarquía, no como decoración
- Animaciones que comunican estado, no que distraen
- El dispositivo responde a su entorno — vivo, no estático

---

## 2. Paleta de colores

### Colores de estado (señal)

| Estado | Color | Uso |
|--------|-------|-----|
| `idle` | `#1a1a2e` | Fondo del vapor, inactivo |
| `listening` | `#4ade80` (green) | Vapor activo, borde glow |
| `thinking` | `#60a5fa` (blue) | Vapor pulsando, procesos |
| `response` | `#c4b5fd` (violet) | Vapor expandido, respuesta |

### Colores de interfaz

```css
--bg:           #000000;    /* Fondo negro profundo */
--surface:      #0f0f14;    /* Tarjetas, paneles elevados */
--surface-2:    #18181f;    /* Widgets, elementos secundarios */
--border:       #1e1e2a;    /* Bordes sutiles */
--border-hover: #2e2e3a;    /* Borde en hover/active */

--fg:           #f1f5f9;    /* Texto principal */
--fg-dim:       #64748b;    /* Texto secundario, labels */
--fg-muted:     #334155;    /* Texto terciario */

--accent:       #4ade80;    /* Acento principal (green) */
--accent-2:     #60a5fa;    /* Acento secundario (blue) */
--accent-3:     #c4b5fd;    /* Acento terciario (violet) */
```

### Sistema de color semántico

- **Negocio/positivo:** green (`--accent`)
- **Información/proceso:** blue (`--accent-2`)
- **Respuesta/creatividad:** violet (`--accent-3`)
- **Error/alarma:** rojo con menor saturación (usar con cuidado)

---

## 3. Tipografía

### Familia

```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
```

**Nota:** Inter como opción open source similar a SF Pro. Si Apple, usar SF Pro Display.

### Escala tipográfica

| Elemento | Tamaño | Weight | Uso |
|----------|--------|--------|-----|
| Display (reloj idle) | `clamp(4rem, 12vw, 8rem)` | 200 | Reloj principal |
| Headline | `1.5rem` | 400 | Títulos de sección |
| Body large | `1.25rem` | 300 | Texto de respuesta Jota |
| Body | `1rem` | 400 | Texto general |
| Label | `0.7rem` | 500 | Labels de widgets, caps |
| Caption | `0.65rem` | 400 | Texto terciario |

### Regla de peso

- Light (200-300) para elementos grandes y destacados
- Regular (400) para texto funcional
- Medium (500) solo para labels y caps (todo en mayúsculas)

---

## 4. El Vapor — Elemento central

### Concepto

Forma ovalada/diamante horizontal (~280×180px base) con colores difuminados moviéndose suavemente. No es geométrico — es un velo de colores orgánicos que nunca están quietos del todo.

### Características

- **Bordes:**Muy difuminados,溶け込む con el fondo. No hay bordes duros.
- **Colores internos:** Mezcla de los colores de estado (green/blue/violet) con opacidad baja (10-25%)
- **Movimiento:** Flujo continuo y sutil incluso en idle
- **Dinamismo según estado:**
  - `idle`: flujo mínimo, muy sutil
  - `listening`: colores fluyen hacia arriba, se alinean
  - `thinking`: pulso suave, como respiración
  - `response`: colores más abiertos, expresivos, expansión sutil

### Implementación técnica (sugerencia)

- Gradientes radiales con animation de posición
- Filtro blur para bordes difuminados (`filter: blur(40px)`)
- Múltiples capas con opacidades diferentes para profundidad
- `mix-blend-mode: screen` para la mezcla de colores
- Animaciones CSS con `cubic-bezier` para suavidad

### Estados

```
idle       → verde muy apagado, flujo mínimo
listening  → verde brillante, glow, flujo ascendente
thinking   → azul pulsante, animación breathing
response   → violeta expandido, colores abiertos
```

---

## 5. Widgets

### Concepto

Tarjetas discretas que se integran en el entorno. Información presente pero no intrusiva. Tamaño variable según el widget.

### Estructura base

```
┌─────────────────────────────────────┐
│  [icon]  Label                 Value│
│          ▓▓▓▓░░░ 65%                 │
└─────────────────────────────────────┘
```

- `surface-2` como fondo
- `border` sutil
- `border-radius: 16px`
- Padding: `1rem`
- Transición: `all 0.3s ease`

### Tipos de widget

#### Toggle (luz,开关)

- Muestra color de la entidad (si tiene color)
- Fill horizontal proporcional al brillo (0-100%)
- Icono animado al cambiar
- Estados: on/off, unavailable

#### Sensor

- Valor grande con unidad
- Label pequeño debajo
- Indicador de tendencia (↑↓) si disponible
- Estados: normal, warning, unavailable

#### Slider (Fase 3)

- Barra de progreso con handle draggable
- Valor numérico actualizado en tiempo real
- Feedback háptico si disponible

#### Media Player (Fase 3)

- Información de canción/artista
- Controles play/pause/skip
- Progreso visual

#### Camera (Fase 3)

- Thumbnail del feed
- Tap para ver en grande

### Animaciones de widget

- **Entrada:** fade-in + translate-y sutil (200ms)
- **Cambio de estado:** transición suave de color/valor (300ms)
- **Interacción:** scale muy sutil en press (0.98)
- **No hay animaciones de loop** —安静

### Grid de widgets

- Grid flexible con auto-layout
- Columnas: 2-3 según ancho disponible
- Widgets pueden ocupar 1 o 2 columnas
- Row height automático según contenido
- Repositioning manual configurable via JSON

---

## 6. Área de conversación

### Disposición

```
┌─────────────────────────────────────┐
│                                     │
│    [VAPOR]                          │
│                                     │
│  ─────────────────────────────────  │  ← Divisor sutil
│                                     │
│  Tú: texto del usuario              │  ← transcript
│                                     │
│  Jota: respuesta de Jota            │  ← response
│                                     │
└─────────────────────────────────────┘
```

### Burbujas

- Sin bordes ni cajas — texto limpio
- Label ("tú" / "jota") en caps, `fg-dim`, pequeño
- Texto de usuario: `fg-dim` (más apagado)
- Texto de Jota: `fg` (blanco)
- Entrada: fade-in + translate-y desde abajo (400ms)
- Transiciones entre estados: crossfade suave

### Divisor

- Línea horizontal muy sutil (`border`)
- Aparece en `response`, desaparece en otros estados

---

## 7. Navegación entre paneles

**Pendiente de decisión según SPEC.md:**
- Swipe horizontal
- NavBar inferior con iconos
- Comando de voz
- Botón flotante

**Lo que sí sabemos:**
- Indicador visual del panel activo
- Transición: slide suave (300ms)
- Sin parallax exagerado

---

## 8. Pantalla idle

### Concepto

El dispositivo responde a su entorno. Cuando no hay interacción, muestra lo que el usuario haya configurado para ese momento.

### Contenido configurable

| Modo | Descripción |
|------|-------------|
| `off` | Pantalla apagada (WallPanel sleep) |
| `clock` | Reloj grande + fecha |
| `clock-weather` | Reloj + tiempo exterior |
| `widgets` | Widgets visibles pero en modo bajo consumo |
| `custom` | URL alternativa o panel HA |

### Reglas horarias

- Configurable en `idle.json`
- Ejemplo: noche → off, día → widgets, madrugada → clock mínimo

### Sensores ambientales

- Brillo de pantalla automático según sensor
- Aktivación por presencia (si disponible)
- No mostrar idle hasta N minutos de inactividad

---

## 9. Animaciones — спец

### Principios

1. **Nunca distraer** — las animaciones comunican, no decoran
2. **Suavidad** — cubic-bezier personalizado, sin linear ni bounce exagerado
3. **Brevedad** — 200-400ms para transiciones de UI, no más
4. **Coherencia** — mismo timing para elementos relacionados

### Timing base

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);   /* entrada, aparece */
--ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1); /* transiciones */
--ease-in:      cubic-bezier(0.7, 0, 0.84, 0);   /* salida, desaparece */

--duration-fast:   150ms;  /* micro-interacciones (hover, press) */
--duration-normal: 300ms;  /* transiciones de estado */
--duration-slow:   500ms;  /* entradas de pantalla */
```

### Animaciones específicas

| Elemento | Animación | Duración | curva |
|----------|-----------|----------|-------|
| Vapor idle | flujo sutil continuo | 8000ms | linear, infinite |
| Vapor listening | flujo ascendente | 2000ms | ease-in-out, loop |
| Vapor thinking | breathing scale | 1800ms | ease-in-out, loop |
| Vapor response | expansión colores | 600ms | ease-out |
| Burbuja entrada | fade + translateY(12px) | 400ms | ease-out |
| Burbuja salida | fade + translateY(-8px) | 250ms | ease-in |
| Widget entrada | fade + translateY(8px) | 300ms | ease-out |
| Widget toggle on | color transition | 300ms | ease-in-out |
| Pantalla cambio | crossfade | 300ms | ease-in-out |

### Reducir animaciones

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Layout del panel — estructura de ejemplo

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   ┌────────────┐          ┌──────────────────────┐   │
│   │            │          │                      │   │
│   │   VAPOR    │          │    Conversación      │   │
│   │            │          │    (transcript +     │   │
│   │            │          │     respuesta)      │   │
│   │            │          │                      │   │
│   └────────────┘          └──────────────────────┘   │
│                                                      │
│   ┌──────────────────────────────────────────────┐   │
│   │  Widget 1   │   Widget 2   │   Widget 3      │   │
│   │  (toggle)   │   (sensor)   │   (2 cols)      │   │
│   └──────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Pero es configurable:** widgets pueden estar abajo, lateral, o en panel separado.

---

## 11. Estilos de componentes

### Superficies

```css
.surface-1 { background: var(--bg); }
.surface-2 { background: var(--surface-2); }
.surface-elevated { background: var(--surface); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
```

### Botones

```css
.btn {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: .75rem 1.5rem;
  color: var(--fg);
  font-size: .875rem;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out),
              border-color var(--duration-fast) var(--ease-out);
}
.btn:hover { background: var(--surface); border-color: var(--border-hover); }
.btn:active { transform: scale(0.98); }
.btn-primary {
  background: var(--accent);
  color: var(--bg);
  border-color: transparent;
}
```

### Iconos

- Sistema: SVG inline o icon font (Material Symbols, Lucide)
- Tamaño: 20-24px para UI, 16px para dentro de widgets
- Color: `currentColor` — hereda del contexto
- Stroke: 1.5-2px para consistencia

---

## 12. Responsive y breakpoints

### Estrategia

- Mobile-first, pero optimizado para landscape (disp. siempre encendido)
- Sin breakpoint fijo — grid flexible con `auto-fit`
- Orientación portrait: layout se reorganiza verticalmente

### Tamaños de referencia

| Dispositivo | Ancho típico | Layout |
|-------------|--------------|--------|
| Teléfono portrait | 360-428px | 1 columna |
| Teléfono landscape | 640-800px | 2 columnas + conversación |
| Tablet portrait | 600-900px | 2 columnas + conversación |
| Tablet landscape | 800-1200px | Vapor lateral + widgets + conversación |
| TV / monitor | 1200px+ | Layout expandido |

---

## 13. Estados de error y vacío

### Sin conexión HA

- Widgets muestran estado "no disponible" con icono apagado
- No hay mensaje intrusivo — el widget simplemente no responde
- Tooltip en hover/long-press: "Sin conexión"

### Sin widgets configurados

- Pantalla de conversación funciona igual
- Mensaje sutil: "Añade widgets en configuración" (solo visible si el usuario navega a settings)

### Loading de entidad

- Skeleton pulse animation en el valor
- Nunca spinner — solo reducción de opacidad del contenido

### Offline del dispositivo

- Mensaje central: "Sin conexión" con retry automático
- Vapor en estado "offline" (color gris apagado)

---

## 14. Accesibilidad

- Contraste mínimo 4.5:1 para texto
- Todos los elementos interactivos con focus visible
- `aria-label` para iconos y elementos sin texto
- Soporte `prefers-reduced-motion`
- Soporte `prefers-contrast`
- Navegación completa por teclado (futuro)

---

## 15. Implementación pendiente

- [ ] Crear mockups/interacciones en Figma o similar (pendiente Visual Companion)
- [ ] Definir animación exacta del Vapor
- [ ] Decidir navegación entre paneles (pendiente)
- [ ] Definir layout por defecto para cada `device.type` (phone/tablet)
- [ ] Validar paleta con contraste y accesibilidad