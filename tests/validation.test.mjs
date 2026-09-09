// node --test    (встроенный раннер, зависимостей не требует)
import test from 'node:test'
import assert from 'node:assert/strict'

import { normalize, normalizeFields, fieldKind, toNumber } from '../src/validation/normalize.js'
import { validate, isValid, overall } from '../src/validation/validate.js'
import { messages, messagesFor } from '../src/validation/messages.js'
import { makeInitialState } from '../src/state/initial.js'

/** Состояние с подменёнными полями. */
const withFields = (fields) => {
  const s = makeInitialState()
  return { ...s, fields: { ...s.fields, ...fields } }
}

test('normalize: таблица 5.1', () => {
  assert.equal(normalize('20.5', 'size'), '20,5')
  assert.equal(normalize('20,5678', 'size'), '20,57')
  assert.equal(normalize('5', 'size'), '10')
  assert.equal(normalize('0', 'size'), '10')
  assert.equal(normalize('0', 'count'), '1')
  assert.equal(normalize('2,7', 'count'), '3')
})

test('normalize: округление всегда в большую сторону', () => {
  assert.equal(normalize('20,571', 'size'), '20,58')
  assert.equal(normalize('100,004', 'size'), '100,01')
  assert.equal(normalize('0,4', 'count'), '1')
  assert.equal(normalize('3,01', 'count'), '4')
})

test('normalize: у глубины свой минимум — 12 мм', () => {
  assert.equal(normalize('5', 'depth'), '12')
  assert.equal(normalize('0', 'depth'), '12')
  assert.equal(normalize('11,99', 'depth'), '12')
  assert.equal(normalize('12', 'depth'), '12')
  assert.equal(normalize('37', 'depth'), '37')
  assert.equal(normalizeFields({ width: '5', depth: '5', nx: '0', ny: '0' }).depth, '12')
})

test('normalize: что не меняется', () => {
  assert.equal(normalize('19,6', 'size'), '19,6')
  assert.equal(normalize('37', 'size'), '37')
  assert.equal(normalize('100', 'size'), '100')
  assert.equal(normalize('3', 'count'), '3')
})

test('normalize: превышение 100 мм не правится — это ERR-02', () => {
  assert.equal(normalize('120', 'size'), '120')
  assert.equal(normalize('100,006', 'size'), '100,01')
})

test('normalize: пустое остаётся пустым, иначе ERR-01 не возникнет', () => {
  assert.equal(normalize('', 'size'), '')
  assert.equal(normalize('   ', 'size'), '')
  assert.equal(normalize('мм', 'size'), '')
  assert.equal(normalize('', 'count'), '')
})

test('normalize: отрицательное поднимается до нижней границы', () => {
  assert.equal(normalize('-5', 'size'), '10')
  assert.equal(normalize('-2', 'count'), '1')
})

test('fieldKind и normalizeFields', () => {
  assert.equal(fieldKind('width'), 'size')
  assert.equal(fieldKind('depth'), 'depth')
  assert.equal(fieldKind('nx'), 'count')
  assert.equal(fieldKind('ny'), 'count')
  assert.deepEqual(
    normalizeFields({ width: '20.5', depth: '5', nx: '0', ny: '3,4' }),
    { width: '20,5', depth: '12', nx: '1', ny: '4' },
  )
})

test('toNumber принимает и запятую, и точку', () => {
  assert.equal(toNumber('19,6'), 19.6)
  assert.equal(toNumber('19.6'), 19.6)
  assert.ok(Number.isNaN(toNumber('')))
})

test('validate: начальные значения ошибок не дают', () => {
  const r = validate(makeInitialState())
  assert.deepEqual(r.errors, [])
  assert.deepEqual(r.fields, { width: false, depth: false, nx: false, ny: false })
  assert.equal(isValid(makeInitialState()), true)
})

test('validate: ERR-01 — пустой размер', () => {
  const r = validate(withFields({ width: '' }))
  assert.deepEqual(r.errors, ['ERR-01'])
  assert.equal(r.fields.width, true)
  assert.equal(r.fields.depth, false)

  // Оба поля пусты — код всё равно один, в Error оба поля.
  const both = validate(withFields({ width: '', depth: '' }))
  assert.deepEqual(both.errors, ['ERR-01'])
  assert.equal(both.fields.width, true)
  assert.equal(both.fields.depth, true)
})

test('validate: ERR-02 — размер больше 100 мм', () => {
  const r = validate(withFields({ depth: '120' }))
  assert.deepEqual(r.errors, ['ERR-02'])
  assert.equal(r.fields.depth, true)
  assert.equal(r.fields.width, false)
})

test('validate: ERR-03 и ERR-04 — пустое количество', () => {
  assert.deepEqual(validate(withFields({ nx: '' })).errors, ['ERR-03'])
  assert.deepEqual(validate(withFields({ ny: '' })).errors, ['ERR-04'])
  assert.deepEqual(validate(withFields({ nx: '', ny: '' })).errors, ['ERR-03', 'ERR-04'])
})

test('validate: ERR-05 — превышение габарита по X', () => {
  // 5 × (100 + 3) = 515 > 500
  const r = validate(withFields({ width: '100', nx: '5' }))
  assert.deepEqual(r.errors, ['ERR-05'])
  assert.equal(r.fields.width, true)
  assert.equal(r.fields.nx, true)
  assert.equal(r.fields.depth, false)
  assert.equal(r.fields.ny, false)
})

test('validate: ERR-06 — превышение габарита по Y', () => {
  const r = validate(withFields({ depth: '100', ny: '5' }))
  assert.deepEqual(r.errors, ['ERR-06'])
  assert.equal(r.fields.depth, true)
  assert.equal(r.fields.ny, true)
})

test('validate: ERR-07 — превышение по обеим осям сразу', () => {
  // Таблица 16: собственного текста у ERR-07 нет, это ERR-05 и ERR-06
  // в одном блоке.
  const r = validate(withFields({ width: '100', nx: '5', depth: '100', ny: '5' }))
  assert.deepEqual(r.errors, ['ERR-05', 'ERR-06'])
  assert.deepEqual(r.fields, { width: true, depth: true, nx: true, ny: true })
  assert.deepEqual(messagesFor(r.errors), [messages['ERR-05'], messages['ERR-06']])
})

test('validate: граница габарита ровно 500 мм проходит', () => {
  // 5 × (97 + 3) = 500
  assert.deepEqual(validate(withFields({ width: '97', nx: '5' })).errors, [])
  // 5 × (97,01 + 3) = 500,05
  assert.deepEqual(validate(withFields({ width: '97,01', nx: '5' })).errors, ['ERR-05'])
})

test('validate: габарит не проверяется поверх пустого поля', () => {
  const r = validate(withFields({ width: '', nx: '99' }))
  assert.deepEqual(r.errors, ['ERR-01'])
})

test('overall: реальный габарит модели', () => {
  const r = overall(makeInitialState())
  // 3 × 22,6 = 67,8 и 3 × 40 = 120 — габарит исходной модели, ТЗ 22
  assert.ok(Math.abs(r.x - 67.8) < 1e-9)
  assert.ok(Math.abs(r.y - 120) < 1e-9)
})
