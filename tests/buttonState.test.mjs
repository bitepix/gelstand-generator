// node --test    (встроенный раннер, зависимостей не требует)
import test from 'node:test'
import assert from 'node:assert/strict'

import { buttonState } from '../src/state/buttonState.js'
import {
  reducer,
  setField,
  normalizeField,
  setShape,
  setPrinter,
  toggleNoPrinter,
} from '../src/state/reducer.js'
import { makeInitialState } from '../src/state/initial.js'
import { snapshot } from '../src/state/snapshot.js'

/** Состояние с уже построенной моделью. */
function ready(patch = {}) {
  const base = { ...makeInitialState(), generation: 'ready', model: {} }
  const state = { ...base, ...patch, fields: { ...base.fields, ...(patch.fields ?? {}) } }
  return { ...state, modelSnapshot: patch.modelSnapshot ?? snapshot(base) }
}

test('генерация идёт — Loading, что бы ни было с параметрами', () => {
  assert.equal(buttonState(ready({ generation: 'pending' })), 'loading')
  assert.equal(
    buttonState(ready({ generation: 'pending', fields: { width: '' } })),
    'loading',
  )
})

test('техническая ошибка — Повторить, раньше проверки параметров', () => {
  assert.equal(buttonState(ready({ generation: 'error', generationError: 'ERR-08' })), 'retry')
})

test('параметры изменены и невалидны — Disabled', () => {
  assert.equal(buttonState(ready({ fields: { width: '' } })), 'disabled')
  assert.equal(buttonState(ready({ fields: { width: '120' } })), 'disabled')
})

test('параметры совпадают с параметрами модели — Скачать', () => {
  assert.equal(buttonState(ready()), 'download')
})

test('ввод не закончен — Disabled: модель ещё про старые параметры', () => {
  // Превью живое, но пересчёт идёт по завершении ввода, а не по нажатию
  // клавиши. Пока строка в поле разошлась с моделью, скачивать нечего.
  assert.equal(buttonState(ready({ fields: { nx: '4' } })), 'disabled')
})

test('возврат значений вручную снова даёт Скачать', () => {
  const base = ready()
  const edited = { ...base, fields: { ...base.fields, nx: '4' } }
  assert.equal(buttonState(edited), 'disabled')

  const restored = { ...edited, fields: { ...edited.fields, nx: '3' } }
  assert.equal(buttonState(restored), 'download')
})

test('модели ещё не было — Loading: счёт идёт с открытия', () => {
  assert.equal(buttonState(makeInitialState()), 'loading')
})

// --- живое превью: что запускает пересчёт ---

test('завершённая правка запускает пересчёт, незавершённая — нет', () => {
  const start = makeInitialState()
  assert.equal(reducer(start, setField('nx', '4')).runId, start.runId)

  const edited = reducer(start, normalizeField('nx', '4'))
  assert.equal(edited.runId, start.runId + 1)
  assert.equal(edited.generation, 'pending')
})

test('blur без правки прогона не начинает', () => {
  const start = makeInitialState()
  assert.equal(reducer(start, normalizeField('nx', '3')), start)
})

test('невалидное значение счёт не запускает', () => {
  const start = makeInitialState()
  const broken = reducer(start, normalizeField('nx', ''))
  assert.equal(broken.fields.nx, '')
  assert.equal(broken.runId, start.runId)
})

test('форма пересчитывает, принтер — нет: модель от принтера не зависит', () => {
  const start = makeInitialState()
  assert.equal(reducer(start, setShape('round')).runId, start.runId + 1)
  // Принтер меняет только предел габарита и стол в превью (ТЗ 7, 11).
  assert.equal(reducer(start, setPrinter('a1')).runId, start.runId)
  assert.equal(reducer(start, toggleNoPrinter()).runId, start.runId)
})

test('правка после набора в поле пересчитывает — setField не глушит blur', () => {
  // Регрессия: setField кладёт строку на каждое нажатие, поэтому к моменту
  // blur поле уже равно тому, что приходит в normalizeField. Сравнение
  // «значение не изменилось» глушило пересчёт наглухо.
  const start = makeInitialState()
  const typed = reducer(start, setField('nx', '4'))
  const done = reducer(typed, normalizeField('nx', '4'))
  assert.equal(done.runId, start.runId + 1)
  assert.equal(done.generation, 'pending')
})

test('повторный blur на том же значении второй раз не считает', () => {
  const start = makeInitialState()
  const once = reducer(reducer(start, setField('nx', '4')), normalizeField('nx', '4'))
  const twice = reducer(once, normalizeField('nx', '4'))
  assert.equal(twice.runId, once.runId)
})
