// Имя файла модели. ТЗ v3, раздел 15.2.
//
// Nail_Modernism_Gelstand_19.6x37mm_3x3.3mf
// В имени всегда точка, независимо от того, что показано в поле ввода.

const PREFIX = 'Nail_Modernism_Gelstand'

const dot = (value) => String(value).replace(',', '.')

/**
 * У круглой ячейки размер один — диаметр: Nail_Modernism_Gelstand_30mm_3x3.3mf
 *
 * @param {Record<string, string>} fields — поля состояния
 * @param {'stl'|'3mf'} ext
 * @param {'rect'|'round'} [shape]
 * @returns {string}
 */
export function fileName(fields, ext, shape = 'rect') {
  const { width, depth, diameter, nx, ny } = fields
  const size = shape === 'round' ? dot(diameter) : `${dot(width)}x${dot(depth)}`
  return `${PREFIX}_${size}mm_${dot(nx)}x${dot(ny)}.${ext}`
}
