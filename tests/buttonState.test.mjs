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

test('смена формы и принтера тоже пересчитывают', () => {
  const start = makeInitialState()
  assert.equal(reducer(start, setShape('round')).runId, start.runId + 1)
  assert.equal(reducer(start, setPrinter('a1')).runId, start.runId + 1)
  assert.equal(reducer(start, toggleNoPrinter()).runId, start.runId + 1)
})
