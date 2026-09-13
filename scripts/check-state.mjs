// Ручная проверка редьюсера. Зависимостей нет: node scripts/check-state.mjs
import assert from 'node:assert/strict'
import { makeInitialState } from '../src/state/initial.js'
import {
  reducer,
  setField,
  normalizeField,
  next,
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
assert.equal(s.step, 1)
assert.equal(s.shape, 'rect')
assert.equal(s.generation, 'idle')

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

// Правка количества подбирает сетку: 17 баночек на поле без принтера.
s = reducer(s, normalizeField('jars', '17'))
assert.equal(Number(s.fields.nx) * Number(s.fields.ny) >= 17, true)
assert.equal(s.fields.jars, '17')

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
assert.equal(s.fields.jars, '17')
s = reducer(s, normalizeField('nx', '3'))
s = reducer(s, normalizeField('ny', '3'))
assert.equal(s.fields.jars, '9')

// Шаги вперёд; 2 → 3 открывает третий шаг в состоянии генерации (ТЗ 8).
s = reducer(s, next())
assert.equal(s.step, 2)
s = reducer(s, next())
assert.equal(s.step, 3)
assert.equal(s.generation, 'pending')
s = reducer(s, next())
assert.equal(s.step, 3)

// Успех: модель и снимок её параметров.
const mesh = { positions: new Float32Array(0), indices: new Uint32Array(0) }
s = reducer(s, generateOk(mesh, snapshot(s)))
assert.equal(s.generation, 'ready')
assert.equal(s.model, mesh)
assert.equal(s.modelSnapshot, 'rect|20,5|37|3|3')
assert.equal(matchesModel(s), true)

// Изменили параметр — снимок разошёлся, модель на месте (ТЗ 9.2).
s = reducer(s, normalizeField('nx', '4'))
assert.equal(matchesModel(s), false)
assert.equal(s.model, mesh)

// Вернули значение вручную — снова совпадение без перегенерации.
s = reducer(s, normalizeField('nx', '3'))
assert.equal(matchesModel(s), true)

// Ошибка обновления: предыдущая модель остаётся (ТЗ 11.2).
s = reducer(s, generateStart())
assert.equal(s.generation, 'pending')
s = reducer(s, generateFail('ERR-09'))
assert.equal(s.generation, 'error')
assert.equal(s.generationError, 'ERR-09')
assert.equal(s.model, mesh)

// Сброс возвращает всё в начальное состояние (ТЗ 15.1).
s = reducer(s, reset())
assert.deepEqual(s, makeInitialState())

console.log('state: ok')
