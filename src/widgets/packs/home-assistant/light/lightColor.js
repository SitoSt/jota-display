export function colorTempToRgb(mireds) {
  const MIN = 153  // frío máximo → azul hielo
  const MAX = 500  // cálido máximo → amber
  const cold = [180, 215, 255]
  const warm = [255, 168, 50]
  const t = Math.min(1, Math.max(0, (mireds - MIN) / (MAX - MIN)))
  return [
    Math.round(cold[0] + (warm[0] - cold[0]) * t),
    Math.round(cold[1] + (warm[1] - cold[1]) * t),
    Math.round(cold[2] + (warm[2] - cold[2]) * t),
  ]
}

export function entityToRgb(entity) {
  const attrs = entity?.attributes ?? {}
  if (attrs.rgb_color)  return attrs.rgb_color
  if (attrs.color_temp) return colorTempToRgb(attrs.color_temp)
  return [255, 168, 50]
}
