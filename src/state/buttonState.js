// Состояние основной кнопки. ТЗ v3, раздел 10.
//
// Состояние не хранится, а выводится из дерева. Порядок проверок — это и есть
// порядок строк таблицы 10: первое подошедшее условие выигрывает.

import { validate } from '../validation/validate.js'
import { snapshot } from './snapshot.js'

/**
 * @param {object} state
 * @returns {'loading' | 'retry' | 'disabled' | 'download' | 'update'}
 */
export function buttonState(state) {
  if (state.generation === 'pending') return 'loading'
  if (state.generation === 'error') return 'retry'
  if (validate(state).errors.length > 0) return 'disabled'
  if (state.modelSnapshot !== null && snapshot(state) === state.modelSnapshot) return 'download'
  return 'update'
}
