// Редьюсер приложения. ТЗ v3, разделы 2, 8, 9, 15.
//
// Редьюсер только меняет состояние. Он ничего не проверяет и ничего не
// нормализует: и то и другое — чистые функции из validation/ (задача A2),
// которые вызываются до dispatch. Поэтому normalizeField получает уже
// нормализованную строку.

import { toNumber } from '../validation/normalize.js'
import { makeInitialState } from './initial.js'
import { snapshot } from './snapshot.js'

/** Поля, которые можно менять. */
const FIELDS = ['width', 'depth', 'jars', 'nx', 'ny']

function setFieldValue(state, field, value) {
  if (!FIELDS.includes(field)) return state
  if (state.fields[field] === value) return state
  return { ...state, fields: { ...state.fields, [field]: value } }
}

/**
 * Количество баночек и сетка описывают одно и то же, поэтому правка сетки
 * пересчитывает количество: ведущим становится то, что человек трогал
 * последним (ТЗ 4.1). Обратный ход — подбор сетки из количества — это G2.
 */
function syncJars(state, field) {
  if (field !== 'nx' && field !== 'ny') return state
  const nx = toNumber(state.fields.nx)
  const ny = toNumber(state.fields.ny)
  if (Number.isNaN(nx) || Number.isNaN(ny)) return state
  return setFieldValue(state, 'jars', String(nx * ny))
}

export function reducer(state, action) {
  switch (action.type) {
    // Ввод в поле: строка кладётся как есть, без нормализации.
    case 'setField':
      return setFieldValue(state, action.field, action.value)

    // Завершение ввода: строка кладётся уже нормализованной (ТЗ 5.1).
    case 'normalizeField':
      return syncJars(setFieldValue(state, action.field, action.value), action.field)

    // Переход вперёд. Возврата назад нет (ТЗ 2).
    // Шаг 2 → 3 сразу открывает третий шаг в состоянии генерации (ТЗ 8).
    case 'next':
      if (state.step === 1) return { ...state, step: 2 }
      if (state.step === 2) {
        return { ...state, step: 3, generation: 'pending', generationError: null }
      }
      return state

    case 'generateStart':
      return { ...state, generation: 'pending', generationError: null }

    // Новая модель заменяет старую, её параметры становятся сохранёнными.
    case 'generateOk':
      return {
        ...state,
        generation: 'ready',
        generationError: null,
        model: action.model,
        modelSnapshot: action.snapshot ?? snapshot(state),
      }

    // Техническая ошибка. Предыдущая успешная модель остаётся (ТЗ 11.2).
    case 'generateFail':
      return { ...state, generation: 'error', generationError: action.code }

    // Полный сброс: данные удаляются, шаг 1, начальные значения (ТЗ 15.1).
    case 'reset':
      return makeInitialState()

    default:
      return state
  }
}

// Создатели действий — чтобы строки типов не разъезжались по компонентам.
export const setField = (field, value) => ({ type: 'setField', field, value })
export const normalizeField = (field, value) => ({ type: 'normalizeField', field, value })
export const next = () => ({ type: 'next' })
export const generateStart = () => ({ type: 'generateStart' })
export const generateOk = (model, snap) => ({ type: 'generateOk', model, snapshot: snap })
export const generateFail = (code) => ({ type: 'generateFail', code })
export const reset = () => ({ type: 'reset' })
