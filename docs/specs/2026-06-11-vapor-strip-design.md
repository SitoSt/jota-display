# VaporStrip — diseño

**Fecha:** 2026-06-11  
**Estado:** aprobado

## Contexto

La pantalla es un móvil Android de 5" en orientación **landscape**. El espacio vertical es escaso. El componente `Vapor.vue` actual (orbe blob con posición configurable izquierda/derecha/arriba/abajo/centro) se **reemplaza en su totalidad** por una franja fija en el borde superior: `VaporStrip.vue`.

## Qué hace

Una franja Canvas 2D pegada al borde superior de la pantalla. Muestra en todo momento el estado del asistente de voz (idle / listening / thinking / response) mediante color y movimiento. Es el único indicador de estado del asistente en el layout.

## Aspecto visual

Cinco manchas de luz grandes y borrosas posicionadas parcialmente por encima del canvas. Sus centros están sobre el borde superior, así solo se ve la "cola" de cada mancha sangrando hacia dentro. Blend mode `screen` hace que los colores se mezclen de forma aditiva creando zonas más brillantes donde se solapan.

**La animación principal es el color**, no la forma. Cada mancha tiene un hue que oscila lentamente de forma independiente. La forma tiene un micro-movimiento orgánico lento (simplex noise) para que nunca parezca estática.

Una línea shimmer de 1.5px en el borde absoluto refuerza el filo luminoso.

El borde inferior del strip se esfuma a negro con un gradiente.

### Paletas por estado

| Estado     | Colores                              | Intensidad | fps target |
|------------|--------------------------------------|------------|------------|
| idle       | verde 140° / esmeralda 160° / teal 190° | 0.55    | 24         |
| listening  | verde vivo 130° / menta 155° / lima 80° | 1.00    | 30         |
| thinking   | azul 215° / índigo 240° / cian 195°  | 0.82       | 30         |
| response   | lavanda 270° / rosa 315° / violeta 245° | 0.88   | 30         |

Las transiciones entre estados duran 1.4s con easing `smoothstep`.

## Arquitectura

### Componente: `src/components/VaporStrip.vue`

- `<canvas>` de ancho 100% × alto configurable via CSS variable `--strip-h` (default 54px)
- Lee `current` de `useVoice` para el estado
- Al hacer tap: misma lógica que el Vapor actual (`startListening` / `cancel`)
- Loop Canvas 2D con throttle de fps por estado y pausa en `visibilitychange`
- Sin dependencia de `useLayout` — la posición es siempre top, fija

### Optimizaciones de rendimiento incluidas

1. **DPR ≤ 1.5** — pinta a resolución reducida en pantallas de alta densidad
2. **fps throttle** — 24fps en idle (la animación es muy lenta), 30fps en estados activos
3. **pausa en `visibilitychange`** — cero CPU cuando la pantalla está apagada

### Layout: `src/style.css` + `src/views/MainView.vue`

El grid actual con `vapor-area` + `conversation-area` se simplifica:

```
MainView
├── VaporStrip          (position: absolute; top: 0; height: var(--strip-h))
└── content-area        (position: absolute; top: var(--strip-h); inset rest 0)
    ├── Conversation    (cuando voiceActive)
    └── WidgetGrid
```

Se eliminan las clases `.vapor-left`, `.vapor-right`, `.vapor-top`, `.vapor-bottom`, `.vapor-center` y sus grid templates. El strip siempre está arriba.

### Composable: `src/composables/useLayout.js`

Se simplifica. La única configuración que queda es la altura del strip:

```js
// layout.json: { "strip": { "height": 54 } }
```

La función `loadLayout` lee este valor e inyecta `--strip-h` en `:root`. `saveLayout` desaparece o queda reducida a guardar la altura.

### Config: `config/layout.json`

El campo `vapor.position` desaparece. Nuevo schema:

```json
{ "strip": { "height": 54 } }
```

### `SettingsDrawer.vue`

Eliminar el selector de posición del vapor. Añadir (opcional, fase posterior) un control de altura del strip.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/Vapor.vue` | Eliminado |
| `src/components/VaporStrip.vue` | Nuevo |
| `src/views/MainView.vue` | Usa VaporStrip; simplifica layout |
| `src/style.css` | Elimina clases vapor-\*; añade layout strip |
| `src/composables/useLayout.js` | Simplifica a altura del strip |
| `config/layout.json` (+ example) | Nuevo schema `strip.height` |
| `src/components/SettingsDrawer.vue` | Elimina selector de posición vapor |

## Lo que NO cambia

- `useVoice.js` — no se toca
- `Conversation.vue` — no se toca
- `WidgetGrid.vue` y widgets — no se tocan
- `IdleScreen.vue` — no se toca
- El sistema de temas (`useTheme.js`) — no se toca

## Decisiones abiertas (para fases posteriores)

- Eficiencia adicional: posibilidad de usar CSS `@property` para idle y Canvas solo para estados activos
- Altura del strip configurable desde `SettingsDrawer`
- Posible soporte de colores personalizados via `config/theme.json` o variables CSS `--vapor-*`
