// Design token: contrasti WCAG 2.2 AA verificati per i due temi (testo 4.5:1, componenti e bordi dei campi 3:1)
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.resolve(__dirname, '../src/index.css'), 'utf8')
const block = (selector) => {
  const i = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))
}
const light = block(':root {')
const dark = block(":root[data-theme='dark']")
const darkMedia = block(":root:not([data-theme='light'])")

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const TEXT = [
  ['text', ['bg', 'surface', 'surface-muted', 'surface-strong', 'primary-soft', 'swim-soft', 'warning-soft', 'danger-soft']],
  ['text-soft', ['bg', 'surface', 'surface-muted']],
  ['text-muted', ['bg', 'surface', 'surface-muted']],
  ['primary', ['bg', 'surface', 'surface-muted', 'primary-soft']],
  ['swim', ['bg', 'surface', 'swim-soft']],
  ['warning', ['bg', 'surface', 'warning-soft']],
  ['danger', ['bg', 'surface', 'danger-soft']],
  ['on-primary', ['primary']],
  ['on-swim', ['swim']],
  ['on-warning', ['warning']],
  ['on-danger', ['danger']],
  ['bg', ['text']], // pulsanti/pillole invertiti (bg-fg text-bg)
]
const UI = [
  ['border-strong', ['bg', 'surface']], // bordo dei campi di inserimento
  ['focus', ['bg', 'surface', 'surface-muted']],
  ['primary', ['surface-strong']], // interruttore attivo vs spento
  ['text-muted', ['surface-strong']], // levetta dell'interruttore spento
  ['chart-1', ['surface']],
  ['chart-2', ['surface']],
]

describe.each([
  ['chiaro', light],
  ['scuro', dark],
])('tema %s', (_, t) => {
  it.each(TEXT.flatMap(([fg, bgs]) => bgs.map((bg) => [fg, bg])))('testo %s su %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
  })
  it.each(UI.flatMap(([fg, bgs]) => bgs.map((bg) => [fg, bg])))('componente %s su %s ≥ 3:1', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3)
  })
})

it('tema scuro identico tra preferenza di sistema e scelta esplicita', () => {
  expect(darkMedia).toEqual(dark)
  expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort())
})
