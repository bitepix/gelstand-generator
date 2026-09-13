// Блок I4: переключение формы ячейки.

import test from 'node:test'
import assert from 'node:assert/strict'

import { reducer, setShape, setField } from '../src/state/reducer.js'
import { makeInitialState } from '../src/state/initial.js'
import { snapshot, matchesModel } from '../src/state/snapshot.js'
import { fileName } from '../src/export/fileName.js'
import { validate } from '../src/validation/validate.js'
import { fieldKind, normalize } from '../src/validation/normalize.js'

const round = (state = makeInitialState()) => reducer(state, setShape('round'))

test('круглая форма не теряет ширину и глубину', () => {
  const state = round()
  assert.equal(state.shape, 'round')
  assert.equal(state.fields.width, '19,6')
  assert.equal(state.fields.diameter, '30')
})

test('повторный выбор той же формы ничего не меняет', () => {
  const state = makeInitialState()
  assert.equal(reducer(state, setShape('rect')), state)
})

test('смена формы пересобирает сетку под новый габарит', () => {
  const state = round(reducer(makeInitialState(), setField('jars', '9')))
  assert.equal(Number(state.fields.nx) * Number(state.fields.ny) >= 1, true)
})

test('у круглой формы проверяется диаметр, а не ширина', () => {
  const state = round()
  state.fields.width = '' // к круглой форме отношения не имеет
  assert.deepEqual(validate(state).errors, [])

  const empty = round()
  empty.fields.diameter = ''
  assert.equal(validate(empty).errors.includes('ERR-01'), true)
  assert.equal(validate(empty).fields.diameter, true)
})

test('диаметр ниже минимума поднимается по blur', () => {
  assert.equal(normalize('12', fieldKind('diameter')), '30')
})

test('снимок круглой формы не зависит от ширины и глубины', () => {
  const state = round()
  const withModel = { ...state, modelSnapshot: snapshot(state) }
  assert.equal(matchesModel({ ...withModel, fields: { ...state.fields, width: '50' } }), true)
  assert.equal(matchesModel({ ...withModel, fields: { ...state.fields, diameter: '40' } }), false)
})

test('имя файла круглой модели содержит один размер', () => {
  const fields = { width: '19,6', depth: '37', diameter: '30', nx: '3', ny: '3' }
  assert.equal(fileName(fields, '3mf', 'round'), 'Nail_Modernism_Gelstand_30mm_3x3.3mf')
  assert.equal(fileName(fields, 'stl'), 'Nail_Modernism_Gelstand_19.6x37mm_3x3.stl')
})
