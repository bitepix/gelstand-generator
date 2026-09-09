// Нормализация полей ввода. ТЗ v3, разделы 5 и 5.1.
//
// Автоматические исправления ошибками не считаются: они срабатывают по
// завершении ввода (blur) и молча приводят строку к допустимому виду.
// Единственное, что normalize не чинит, — превышение 100 мм: введённое
// значение остаётся в поле, а поле уходит в Error (ТЗ 5.2). Пустое поле
// тоже остаётся пустым: иначе ERR-01 и ERR-03/04 никогда бы не возникли.

import { SIZE_MIN, DEPTH_MIN, SIZE_DECIMALS, COUNT_MIN } from '../constants.js'

/** Вид поля по его имени. У глубины свой минимум, поэтому свой вид. */
export function fieldKind(field) {
  if (field === 'nx' || field === 'ny') return 'count'
  return field === 'depth' ? 'depth' : 'size'
}

/**
 * Строка поля → число. Разделитель — запятая, точка тоже принимается.
 * Возвращает NaN, если цифр в строке нет.
 */
export function toNumber(raw) {
  const s = String(raw ?? '').replace(/\s/g, '').replace(',', '.')
  return /\d/.test(s) ? Number.parseFloat(s) : NaN
}

/** Число → строка поля: точка меняется на запятую, хвостовые нули убираются. */
export function toField(n) {
  return String(n).replace('.', ',')
}

/**
 * Приводит сырую строку поля к допустимому виду. ТЗ 5.1.
 *
 * @param {string} raw   что ввёл пользователь
 * @param {'size'|'depth'|'count'} kind
 * @returns {string}     нормализованная строка; пустая строка остаётся пустой
 */
export function normalize(raw, kind) {
  const n = toNumber(raw)
  if (Number.isNaN(n)) return ''

  if (kind === 'count') {
    // Дробное округляется вверх, ноль и отрицательное поднимаются до 1 (ТЗ 5.1).
    return String(Math.max(Math.ceil(n), COUNT_MIN))
  }

  // Размер: округление до двух знаков в большую сторону, подъём до нижней
  // границы. Верхняя граница не правится — это ERR-02.
  const factor = 10 ** SIZE_DECIMALS
  // toFixed гасит двоичный хвост: без него 19,6 × 100 = 1960.0000000000002
  // и ceil дал бы 19,61.
  const rounded = Math.ceil(Number((n * factor).toFixed(6))) / factor
  const min = kind === 'depth' ? DEPTH_MIN : SIZE_MIN
  return toField(rounded < min ? min : rounded)
}

/** Нормализует все четыре поля разом — для проверки перед генерацией (ТЗ 5.3). */
export function normalizeFields(fields) {
  const out = {}
  for (const [field, value] of Object.entries(fields)) {
    out[field] = normalize(value, fieldKind(field))
  }
  return out
}
