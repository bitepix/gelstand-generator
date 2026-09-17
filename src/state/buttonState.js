// Состояние основной кнопки. ТЗ v5, раздел 10.
//
// Состояние не хранится, а выводится из дерева. Порядок проверок — это и есть
// порядок строк таблицы 10: первое подошедшее условие выигрывает.
//
// Превью живое: любая завершённая правка сама запускает пересчёт, поэтому
// отдельного «Обновить» больше нет. Расхождение полей с моделью означает,
// что ввод ещё не закончен, — и тогда скачивать нечего.

import { validate } from './../validation/validate.js'
import { matchesModel } from './snapshot.js'

/**
 * @param {object} state
 * @returns {'loading' | 'retry' | 'disabled' | 'download'}
 */
export function buttonState(state) {
  if (state.generation === 'pending') return 'loading'
  if (state.generation === 'error') return 'retry'
  if (validate(state).errors.length > 0) return 'disabled'
  return matchesModel(state) ? 'download' : 'disabled'
}
