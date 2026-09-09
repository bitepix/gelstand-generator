// Снимок параметров модели. ТЗ v3, раздел 9.2.

/**
 * Сериализует параметры в строку для сравнения «текущие поля против
 * параметров последней успешной модели». Сравниваются нормализованные
 * значения, поэтому snapshot вызывается уже после нормализации полей
 * (она происходит по blur, см. ТЗ 17.1).
 *
 * @param {{ shape: string, fields: { width: string, depth: string, nx: string, ny: string } }} state
 * @returns {string}
 */
export function snapshot(state) {
  const { shape, fields } = state
  return [shape, fields.width, fields.depth, fields.nx, fields.ny].join('|')
}

/** Совпадают ли текущие параметры с параметрами последней успешной модели. */
export function matchesModel(state) {
  return state.modelSnapshot !== null && snapshot(state) === state.modelSnapshot
}
