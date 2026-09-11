// node --test
import test from 'node:test'
import assert from 'node:assert/strict'

import { PRINTERS, EDGE_MARGIN, printerLabel, findPrinter, printField } from '../src/printers.js'

test('линейка: тринадцать моделей в алфавитном порядке', () => {
  assert.equal(PRINTERS.length, 13)
  const names = PRINTERS.map((p) => p.name)
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')))
  // Снятые с производства остаются: они стоят у людей.
  for (const id of ['p1p', 'x1c', 'x1e']) assert.ok(findPrinter(id), id)
})

test('подпись пункта: название и область через тире', () => {
  assert.equal(printerLabel(findPrinter('a1')), 'Bambu Lab A1 — 256 × 256 мм')
  assert.equal(printerLabel(findPrinter('a2l')), 'Bambu Lab A2L — 330 × 320 мм')
})

test('полезное поле: стол минус отступ с каждой стороны', () => {
  assert.deepEqual(printField({ printer: 'a1', noPrinter: false }), { x: 196, y: 196 })
  assert.deepEqual(printField({ printer: 'h2d', noPrinter: false }), { x: 290, y: 260 })
  assert.equal(EDGE_MARGIN, 30)
})

test('без принтера и при галочке — наибольший стол, без вычета', () => {
  const largest = { x: 350, y: 320 }
  assert.deepEqual(printField({ printer: null, noPrinter: false }), largest)
  assert.deepEqual(printField({ printer: 'a1-mini', noPrinter: true }), largest)
})
