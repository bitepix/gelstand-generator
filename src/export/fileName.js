// Имя файла модели. ТЗ v3, раздел 15.2.
//
// Nail_Modernism_Gelstand_19.6x37mm_3x3.3mf
// В имени всегда точка, независимо от того, что показано в поле ввода.

const PREFIX = 'Nail_Modernism_Gelstand'

const dot = (value) => String(value).replace(',', '.')

/**
 * @param {{ width: string, depth: string, nx: string, ny: string }} params — поля состояния
 * @param {'stl'|'3mf'} ext
 * @returns {string}
 */
export function fileName(params, ext) {
  const { width, depth, nx, ny } = params
  return `${PREFIX}_${dot(width)}x${dot(depth)}mm_${dot(nx)}x${dot(ny)}.${ext}`
}
