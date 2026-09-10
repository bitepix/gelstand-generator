// node --test    (встроенный раннер, зависимостей не требует)
import test from 'node:test'
import assert from 'node:assert/strict'

import { buttonState } from '../src/state/buttonState.js'
import { makeInitialState } from '../src/state/initial.js'
import { snapshot } from '../src/state/snapshot.js'

/** Состояние шага 3 с уже построенной моделью. */
function ready(patch = {}) {
  const base = { ...makeInitialState(), step: 3, generation: 'ready', model: {} }
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

test('параметры изменены и валидны — Обновить', () => {
  assert.equal(buttonState(ready({ fields: { nx: '4' } })), 'update')
})

test('возврат значений вручную снова даёт Скачать, без перегенерации', () => {
  const base = ready()
  const edited = { ...base, fields: { ...base.fields, nx: '4' } }
  assert.equal(buttonState(edited), 'update')

  const restored = { ...edited, fields: { ...edited.fields, nx: '3' } }
  assert.equal(buttonState(restored), 'download')
})

test('модели ещё не было — Обновить, а не Скачать', () => {
  const fresh = { ...makeInitialState(), step: 3 }
  assert.equal(buttonState(fresh), 'update')
})
