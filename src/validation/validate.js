// Проверка параметров. ТЗ v3, разделы 5.2, 5.3, 7, 16.
//
// Чистая функция: один и тот же результат во всех трёх точках вызова —
// по blur, по кнопке продолжения и перед каждым запуском генерации.

import { SIZE_MAX, PITCH_EXTRA } from '../constants.js'
import { printField } from '../printers.js'
import { toNumber } from './normalize.js'

const NO_ERRORS = { width: false, depth: false, jars: false, nx: false, ny: false }

/**
 * @param {{ fields: { width: string, depth: string, nx: string, ny: string } }} state
 * @returns {{ errors: string[], fields: Record<string, boolean> }}
 *   errors — коды в порядке ERR-01 … ERR-06;
 *   fields — какие поля показать в состоянии Error.
 */
export function validate(state) {
  const { width, depth, jars, nx, ny } = state.fields
  const errors = []
  const fields = { ...NO_ERRORS }

  const w = toNumber(width)
  const d = toNumber(depth)
  const cx = toNumber(nx)
  const cy = toNumber(ny)

  // ERR-01 — пустое поле размера. Один код на оба поля, ТЗ 16.
  const widthEmpty = Number.isNaN(w)
  const depthEmpty = Number.isNaN(d)
  if (widthEmpty || depthEmpty) {
    errors.push('ERR-01')
    fields.width ||= widthEmpty
    fields.depth ||= depthEmpty
  }

  // ERR-02 — размер больше 100 мм. Значение не правится автоматически.
  const widthTooBig = !widthEmpty && w > SIZE_MAX
  const depthTooBig = !depthEmpty && d > SIZE_MAX
  if (widthTooBig || depthTooBig) {
    errors.push('ERR-02')
    fields.width ||= widthTooBig
    fields.depth ||= depthTooBig
  }

  // ERR-11 — не указано количество баночек.
  if (Number.isNaN(toNumber(jars))) {
    errors.push('ERR-11')
    fields.jars = true
  }

  // ERR-03, ERR-04 — пустое количество.
  if (Number.isNaN(cx)) {
    errors.push('ERR-03')
    fields.nx = true
  }
  if (Number.isNaN(cy)) {
    errors.push('ERR-04')
    fields.ny = true
  }

  // ERR-05, ERR-06 — габарит. Формула раздела 7: считается по реальному
  // внешнему размеру, шаг сетки = размер полости + 3,0, а предел берётся из
  // полезного поля выбранного принтера.
  // Ось проверяется только если обе её величины уже прошли предыдущие
  // проверки: иначе к пустому полю добавился бы шум про габарит.
  const axisX = !widthEmpty && !widthTooBig && !Number.isNaN(cx)
  const axisY = !depthEmpty && !depthTooBig && !Number.isNaN(cy)

  const field = printField(state)

  if (axisX && cx * (w + PITCH_EXTRA) > field.x) {
    errors.push('ERR-05')
    fields.width = true
    fields.nx = true
  }
  if (axisY && cy * (d + PITCH_EXTRA) > field.y) {
    // Обе оси разом — это ERR-07 из таблицы 16: два сообщения в одном блоке.
    errors.push('ERR-06')
    fields.depth = true
    fields.ny = true
  }

  return { errors, fields }
}

/** Параметры годятся для генерации. */
export function isValid(state) {
  return validate(state).errors.length === 0
}

/**
 * Реальный габарит модели, мм. ТЗ 7 и 11.4 — показывается под превью.
 * Считается только для валидных параметров.
 */
export function overall(state) {
  const { width, depth, nx, ny } = state.fields
  return {
    x: toNumber(nx) * (toNumber(width) + PITCH_EXTRA),
    y: toNumber(ny) * (toNumber(depth) + PITCH_EXTRA),
  }
}
