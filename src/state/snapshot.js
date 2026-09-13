// Снимок параметров модели. ТЗ v3, раздел 9.2.

/**
 * Сериализует параметры в строку для сравнения «текущие поля против
 * параметров последней успешной модели». Сравниваются нормализованные
 * значения, поэтому snapshot вызывается уже после нормализации полей
 * (она происходит по blur, см. ТЗ 17.1).
 *
 * Размерные поля берутся по форме ячейки: у круглой ширина и глубина не
 * участвуют, и их правка не должна делать модель устаревшей.
 *
 * @param {{ shape: string, fields: Record<string, string> }} state
 * @returns {string}
 */
export function snapshot(state) {
  const { shape, fields } = state
  const size = shape === 'round' ? [fields.diameter] : [fields.width, fields.depth]
  return [shape, ...size, fields.nx, fields.ny].join('|')
}

/** Совпадают ли текущие параметры с параметрами последней успешной модели. */
export function matchesModel(state) {
  return state.modelSnapshot !== null && snapshot(state) === state.modelSnapshot
}
