import { describe, it, expect } from 'vitest'
import { colorTempToRgb, entityToRgb } from '../../src/widgets/packs/home-assistant/lightColor.js'

describe('colorTempToRgb', () => {
  it('retorna azul hielo en 153 mireds (frío)', () => {
    expect(colorTempToRgb(153)).toEqual([180, 215, 255])
  })

  it('retorna amber en 500 mireds (cálido)', () => {
    expect(colorTempToRgb(500)).toEqual([255, 168, 50])
  })

  it('retorna valor interpolado para temp media', () => {
    const [r, , b] = colorTempToRgb(326)
    expect(r).toBeGreaterThan(180)
    expect(r).toBeLessThan(255)
    expect(b).toBeGreaterThan(50)
    expect(b).toBeLessThan(255)
  })

  it('clampea valores fuera del rango', () => {
    expect(colorTempToRgb(0)).toEqual([180, 215, 255])
    expect(colorTempToRgb(9999)).toEqual([255, 168, 50])
  })
})

describe('entityToRgb', () => {
  it('usa rgb_color cuando está disponible', () => {
    expect(entityToRgb({ attributes: { rgb_color: [255, 100, 0] } })).toEqual([255, 100, 0])
  })

  it('usa color_temp cuando no hay rgb_color', () => {
    expect(entityToRgb({ attributes: { color_temp: 500 } })).toEqual([255, 168, 50])
  })

  it('retorna amber por defecto cuando no hay atributos de color', () => {
    expect(entityToRgb({ attributes: {} })).toEqual([255, 168, 50])
  })

  it('retorna amber con entidad null o undefined', () => {
    expect(entityToRgb(null)).toEqual([255, 168, 50])
    expect(entityToRgb(undefined)).toEqual([255, 168, 50])
  })
})
