# Widget Grid — Sistema de Spans Libres

**Fecha:** 2026-06-16  
**Estado:** Aprobado, pendiente de implementación

---

## Contexto

El grid de widgets actual usa un enum de cuatro tamaños fijos (`small`, `horizontal`, `medium`, `large`) mapeados a spans de celda (`cellPx × cols`). Esto limita la capacidad del usuario para personalizar layouts. El objetivo es reemplazarlo por un sistema de spans libres (columnas × filas) sobre un grid de 12 columnas, siguiendo el modelo de HA Sections.

---

## Modelo de datos

### Widget (`config/widgets.json`)

El campo `size` desaparece y se reemplaza por `cols` y `rows`:

```json
{
  "id": "uuid",
  "type": "home-assistant:light",
  "entity": "light.lampara_salon",
  "label": "Lámpara Salón",
  "cols": 3,
  "rows": 3
}
```

### Grid config (`config/grid.json`)

`cellPx` y `cols` desaparecen. Nuevos campos:

```json
{
  "totalCols": 12,
  "rowHeight": 60,
  "gap": 8
}
```

- `totalCols` — número total de columnas del grid (configurable desde ajustes, defecto 12)
- `rowHeight` — altura en px de cada fila (reemplaza `cellPx`, defecto 60)
- `gap` — sin cambios (defecto 8)

### Migración automática de `size`

Al cargar un widget con campo `size` heredado, se convierte una sola vez:

| `size` | `cols` | `rows` |
|--------|--------|--------|
| `small` | 4 | 2 |
| `horizontal` | 4 | 1 |
| `medium` | 8 | 2 |
| `large` | 12 | 2 |

La migración ocurre en `useWidgets` al cargar. Tras guardar, el campo `size` queda eliminado del JSON.

---

## Arquitectura del grid

### `WidgetGrid.vue`

El grid CSS usa columnas fraccionarias (no píxeles fijos), lo que hace el layout naturalmente responsivo:

```css
grid-template-columns: repeat(12, 1fr);
grid-auto-rows: 60px;
gap: 8px;
```

Cada widget se posiciona con sus spans:

```css
grid-column: span 3;
grid-row: span 3;
```

El orden de los widgets en el DOM (= orden del array `widgets`) determina el auto-placement de CSS Grid. No se almacenan coordenadas x/y. Drag-to-reorder = reordenar el array.

### Eliminaciones en `WidgetGrid.vue`

- El mapa `SPANS` desaparece completamente
- La función `spanStyle(size)` desaparece
- El computed `tableroGridStyle` se simplifica (solo `gap` y `grid-auto-rows`)

### `useGridConfig`

| Antes | Después |
|-------|---------|
| `cellPx`, `setCellPx` | eliminados |
| `gridCols`, `setCols` | → `totalCols`, `setTotalCols` |
| `gridGap`, `setGap` | sin cambios |
| — | `rowHeight`, `setRowHeight` (nuevo) |

---

## Definiciones de widget

Cada definición de tipo de widget declara su tamaño mínimo y tamaño por defecto:

```javascript
// sensor/index.js
{
  type: 'home-assistant:sensor',
  label: 'Sensor',
  minCols: 2,
  minRows: 2,
  defaultCols: 4,
  defaultRows: 3,
  // el campo 'sizes' desaparece
}

// light/index.js
{
  type: 'home-assistant:light',
  label: 'Luz',
  minCols: 2,
  minRows: 2,
  defaultCols: 4,
  defaultRows: 3,
}
```

`minCols`/`minRows` bloquean los sliders del editor — el usuario no puede bajar de ahí. `defaultCols`/`defaultRows` son los valores al añadir el widget por primera vez y el preset "por defecto" en el editor.

---

## Props de widget — renderizado adaptativo

`WidgetShell` calcula el tamaño real en píxeles y lo pasa a cada widget:

```javascript
// WidgetShell computa:
const columnWidth = containerWidth / totalCols  // aproximado, antes de gap
const widthPx  = cols * columnWidth + (cols - 1) * gap
const heightPx = rows * rowHeight + (rows - 1) * gap
```

Estos props (`widthPx`, `heightPx`) se pasan a los componentes de widget. La prop `size` desaparece. Cada widget implementa renderizado adaptativo basado en estos valores.

### Niveles adaptativos por widget (orientativos)

**Sensor:**

| Rango de `heightPx` | Contenido |
|---------------------|-----------|
| < 100px | Solo valor + unidad |
| 100–160px | Valor + unidad + label |
| > 160px | Todo + tendencia/gráfica |

**Light:**

| Rango de `heightPx` | Contenido |
|---------------------|-----------|
| < 100px | Solo icono |
| 100–160px | Icono + label |
| > 160px | Icono + label + brillo |

Los umbrales exactos son responsabilidad de cada widget. No hay un sistema de breakpoints global.

---

## Editor UI — bottom sheet expandido

### Activación

Igual que el sistema actual: modo edición → botón ⚙ sobre un widget → sheet sube con animación `sheet-up`.

### Estructura del sheet

```
┌─────────────────────────────────────────────┐
│  [×]   Lámpara Salón   light.lampara_salon  │
├─────────────────────────────────────────────┤
│  MINI-PREVIEW DEL GRID                      │
│  (grid escalado, widget seleccionado en     │
│   color acento, resto en gris translúcido,  │
│   se actualiza en tiempo real)              │
├─────────────────────────────────────────────┤
│  Ancho  [────●──────────────]  3 cols       │
│  Alto   [──●────────────────]  3 filas      │
├─────────────────────────────────────────────┤
│  [S: 2×2]  [M: 4×3]  [L: 6×4]  [XL: 12×4] │
├─────────────────────────────────────────────┤
│              [ 🗑 Eliminar widget ]          │
└─────────────────────────────────────────────┘
```

### Mini-preview

- Renderizado en CSS Grid escalado (transform: scale o unidades proporcionales)
- Muestra todos los widgets del tablero como rectángulos
- El widget seleccionado: color acento + borde resaltado
- Otros widgets: fill gris translúcido
- Se actualiza reactivamente mientras el usuario mueve los sliders

### Sliders

- **Ancho:** rango `minCols` → `totalCols`, paso 1
- **Alto:** rango `minRows` → 8, paso 1
- Al llegar al mínimo: el slider rebota visualmente (animación corta) y no baja más
- Label junto al slider: `3 cols (~180px)`

### Presets

Cuatro botones S / M / L / XL con valores fijos:

| Preset | cols | rows |
|--------|------|------|
| S | `minCols` | `minRows` |
| M | `defaultCols` | `defaultRows` |
| L | `defaultCols × 1.5` (redondeado) | `defaultRows + 1` |
| XL | `totalCols` | `defaultRows + 2` |

El preset correspondiente al tamaño actual se resalta.

### Aplicación de cambios

Los cambios de cols/rows se aplican **inmediatamente** mientras el usuario arrastra el slider. El widget en el grid real cambia de tamaño en vivo. Al cerrar el sheet, el estado ya está guardado.

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/composables/useGridConfig.js` | Nuevos campos: `totalCols`, `rowHeight`; elimina `cellPx`, renombra `gridCols` |
| `src/composables/useWidgets.js` | Migración automática de `size` → `cols`/`rows` al cargar |
| `src/widgets/WidgetGrid.vue` | Elimina `SPANS`, nuevo CSS Grid, nuevos spans por widget |
| `src/widgets/WidgetShell.vue` | Calcula y pasa `widthPx`/`heightPx`; elimina prop `size` |
| `src/widgets/packs/home-assistant/sensor/index.js` | Añade `minCols`, `minRows`, `defaultCols`, `defaultRows`; elimina `sizes` |
| `src/widgets/packs/home-assistant/light/index.js` | Ídem |
| `src/widgets/packs/home-assistant/sensor/SensorWidget.vue` | Renderizado adaptativo basado en `widthPx`/`heightPx` |
| `src/widgets/packs/home-assistant/light/LightWidget.vue` | Ídem |
| `src/components/SettingsDrawer.vue` | Elimina size-pills, `SIZE_LABELS`, `SPANS`; añade sheet expandido con mini-preview y sliders |
| `config/grid.json` | Nuevos campos: `totalCols`, `rowHeight`; elimina `cellPx`, `cols` |

---

## Fuera de alcance (esta iteración)

- Posicionamiento absoluto (x, y) de widgets
- Drag para mover a posición específica del grid (solo reordenar)
- Widget de tipo nuevo
- Visibilidad condicional de widgets
