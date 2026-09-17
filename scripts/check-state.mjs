// Ручная проверка редьюсера. Зависимостей нет: node scripts/check-state.mjs
import assert from 'node:assert/strict'
import { makeInitialState } from '../src/state/initial.js'
import {
  reducer,
  setField,
  normalizeField,
  setPrinter,
  toggleNoPrinter,
  generateStart,
  generateOk,
  generateFail,
  reset,
} from '../src/state/reducer.js'
import { snapshot, matchesModel } from '../src/state/snapshot.js'

let s = makeInitialState()

// Начальные значения — ТЗ 3, все поля строки.
assert.deepEqual(s.fields, { width: '19,6', depth: '37', diameter: '30', jars: '9', nx: '3', ny: '3' })
for (const v of Object.values(s.fields)) assert.equal(typeof v, 'string')
assert.equal(s.shape, 'rect')
assert.equal(s.generation, 'pending') // счёт идёт с открытия

// Ввод кладётся как есть, нормализация приходит отдельным действием.
s = reducer(s, setField('width', '20.5'))
assert.equal(s.fields.width, '20.5')
s = reducer(s, normalizeField('width', '20,5'))
assert.equal(s.fields.width, '20,5')

// Количество баночек и сетка описывают одно и то же, связь двусторонняя
// (ТЗ 4.1 и 6.3). Ведущим становится последнее тронутое поле.
assert.equal(s.fields.jars, '9')
s = reducer(s, normalizeField('nx', '4'))
assert.equal(s.fields.jars, '12')
s = reducer(s, normalizeField('ny', '5'))
assert.equal(s.fields.jars, '20')

// Правка количества подбирает сетку: 24 баночки на поле без принтера.
s = reducer(s, normalizeField('jars', '24'))
assert.equal(Number(s.fields.nx) * Number(s.fields.ny) >= 24, true)
assert.equal(s.fields.jars, '24')

// Смена принтера тоже: полезное поле стало меньше, сетка пересобралась.
s = reducer(s, setPrinter('a1-mini'))
assert.equal(s.printer, 'a1-mini')
assert.equal(s.noPrinter, false)
const mini = `${s.fields.nx}×${s.fields.ny}`
s = reducer(s, toggleNoPrinter())
assert.equal(s.printer, null)
assert.equal(s.noPrinter, true)
assert.notEqual(`${s.fields.nx}×${s.fields.ny}`, mini)

// Пустая сетка количество не портит: пересчитывать не из чего.
s = reducer(s, normalizeField('nx', ''))
assert.equal(s.fields.jars, '24')
s = reducer(s, normalizeField('nx', '3'))
s = reducer(s, normalizeField('ny', '3'))
assert.equal(s.fields.jars, '9')

// Превью живое: завершённая правка сама запускает пересчёт (ТЗ 9).
assert.equal(s.generation, 'pending')
const runBefore = s.runId
s = reducer(s, normalizeField('ny', '3'))
assert.equal(s.runId, runBefore, 'то же значение — нового прогона нет')
s = reducer(s, normalizeField('ny', '4'))
assert.equal(s.runId, runBefore + 1)
assert.equal(s.generation, 'pending')
s = reducer(s, normalizeField('ny', '3'))

// Невалидные параметры счёт не запускают: в превью остаётся прежняя модель.
const beforeBad = s.runId
s = reducer(s, normalizeField('nx', ''))
assert.equal(s.runId, beforeBad)

s = reducer(s, normalizeField('nx', '3'))
assert.equal(s.fields.jars, '9')

// Успех: модель и снимок её параметров.
const mesh = { positions: new Float32Array(0), indices: new Uint32Array(0) }
s = reducer(s, generateOk(mesh, snapshot(s)))
assert.equal(s.generation, 'ready')
assert.equal(s.model, mesh)
assert.equal(s.modelSnapshot, 'rect|20,5|37|3|3')
assert.equal(matchesModel(s), true)

// Изменили параметр — снимок разошёлся, модель на месте до конца пересчёта
// (ТЗ 9.2, 11.2): превью не пустеет, пока считается новая.
s = reducer(s, normalizeField('nx', '4'))
assert.equal(matchesModel(s), false)
assert.equal(s.model, mesh)
assert.equal(s.generation, 'pending')

// Вернули значение вручную — снова совпадение.
s = reducer(s, generateOk(mesh, snapshot(s)))
s = reducer(s, normalizeField('nx', '3'))
assert.equal(matchesModel(s), false)
s = reducer(s, generateOk(mesh, snapshot(s)))
assert.equal(matchesModel(s), true)

// Ошибка обновления: предыдущая модель остаётся (ТЗ 11.2).
s = reducer(s, generateStart())
assert.equal(s.generation, 'pending')
s = reducer(s, generateFail('ERR-09'))
assert.equal(s.generation, 'error')
assert.equal(s.generationError, 'ERR-09')
assert.equal(s.model, mesh)

// Сброс возвращает всё в начальное состояние и запускает пересчёт (ТЗ 15.1).
s = reducer(s, reset())
assert.deepEqual(s, makeInitialState())
assert.equal(s.generation, 'pending')

console.log('state: ok')
