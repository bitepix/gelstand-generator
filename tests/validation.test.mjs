// node --test    (встроенный раннер, зависимостей не требует)
import test from 'node:test'
import assert from 'node:assert/strict'

import { normalize, normalizeFields, fieldKind, toNumber } from '../src/validation/normalize.js'
import { validate, isValid } from '../src/validation/validate.js'
import { messages, messagesFor } from '../src/validation/messages.js'
import { plural } from '../src/validation/plural.js'
import { makeInitialState } from '../src/state/initial.js'
import { COUNT_MAX } from '../src/constants.js'

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
  assert.deepEqual(r.fields, { width: false, depth: false, diameter: false, nx: false, ny: false })
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

test('validate: габарит стола больше не ошибка', () => {
  // Предел печати снят (ТЗ 7): подставка крупнее стола — предупреждение,
  // контур в превью краснеет, а параметры остаются валидными.
  assert.deepEqual(validate(withFields({ width: '100', nx: '50' })).errors, [])
  assert.deepEqual(validate({ ...withFields({ nx: '50', ny: '50' }), printer: 'a1-mini' }).errors, [])
  assert.equal(isValid(withFields({ width: '100', depth: '100', nx: '50', ny: '50' })), true)
})

test('validate: пустое поле остаётся ошибкой', () => {
  assert.deepEqual(validate(withFields({ width: '', nx: '99' })).errors, ['ERR-01'])
})

test('plural: формы по последней цифре', () => {
  const forms = ['подставка', 'подставки', 'подставок']
  const say = (n) => `${n} ${plural(n, forms)}`
  assert.equal(say(1), '1 подставка')
  assert.equal(say(2), '2 подставки')
  assert.equal(say(4), '4 подставки')
  assert.equal(say(5), '5 подставок')
  assert.equal(say(11), '11 подставок')
  assert.equal(say(14), '14 подставок')
  assert.equal(say(21), '21 подставка')
  assert.equal(say(22), '22 подставки')
  assert.equal(say(25), '25 подставок')
  assert.equal(say(111), '111 подставок')
})

test('normalize: количество по оси не уходит выше COUNT_MAX', () => {
  // Предел не про печать, а про то, чтобы браузер пережил ввод: 999 × 999
  // убило бы вкладку раньше, чем сработал бы тайм-аут генерации.
  assert.equal(normalize('999', 'count'), String(COUNT_MAX))
  assert.equal(normalize('50', 'count'), '50')
  assert.equal(normalize('0', 'count'), '1')
})
