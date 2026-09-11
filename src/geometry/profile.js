// Плоские профили плитки и сетки. ТЗ v3, разделы 12.3 и 12.4.
//
// Вся деталь описывается двумя плоскими фигурами — основанием и стойками, —
// и получается двумя выдавливаниями (12.4). Обе фигуры это наборы
// прямоугольников со сторонами по осям, поэтому здесь только арифметика.
//
// Модуль намеренно не зависит от manifold-3d: контуры считаются и
// проверяются без WASM, склейка и выдавливание — в build.js.

import { WALL, ARM_X, ARM_Y, LEDGE, PITCH_EXTRA } from '../constants.js'

/** Прямоугольник как контур против часовой стрелки — материал. */
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** Тот же прямоугольник по часовой — отверстие. */
const hole = (x0, y0, x1, y1) => rect(x0, y0, x1, y1).reverse()

/** Габарит плитки, он же шаг сетки. ТЗ 12.3: W = w + 2t, D = d + 2t. */
export function tileSize(width, depth) {
  return { W: width + PITCH_EXTRA, D: depth + PITCH_EXTRA }
}

/** Прямоугольник по двум углам в любом порядке — всегда против часовой. */
function span(list, xa, xb, ya, yb) {
  list.push(rect(Math.min(xa, xb), Math.min(ya, yb), Math.max(xa, xb), Math.max(ya, yb)))
}

function requireSize(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`profiles: ${name} — положительное число, получено ${value}`)
  }
}

function requireCount(name, value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`profiles: ${name} — целое от 1, получено ${value}`)
  }
}

/**
 * Контуры основания и стоек для всей сетки, в положительном квадранте.
 *
 * Ориентация контуров значащая: против часовой — материал, по часовой —
 * отверстие. Наложения между контурами допустимы, их снимает fill rule
 * при сборке CrossSection.
 *
 * @param {{ width: number, depth: number, nx: number, ny: number }} params
 *   width, depth — размеры полости в мм; nx, ny — количество ячеек.
 * @returns {{ base: number[][][], posts: number[][][], size: { x: number, y: number } }}
 */
export function profiles({ width, depth, nx, ny }) {
  requireSize('width', width)
  requireSize('depth', depth)
  requireCount('nx', nx)
  requireCount('ny', ny)

  const { W, D } = tileSize(width, depth)
  const size = { x: nx * W, y: ny * D }

  // Основание. Плитки стыкуются встык, поэтому объединение их прямоугольников
  // — это один прямоугольник габарита сетки. Проёмы не касаются краёв плитки
  // и между собой не сливаются, так что каждый остаётся отдельным отверстием.
  const base = [rect(0, 0, size.x, size.y)]

  // Проём в основании — не прямоугольник, а крест: это открытая зона ячейки,
  // ужатая на LEDGE со всех сторон (reference/README.md). Баночка садится на
  // полку шириной LEDGE. Два прямоугольника перекрываются; вычитание их по
  // очереди равносильно вычитанию объединения.
  // Проёма нет, если плечи стоек сходятся. До интерфейса такая ячейка не
  // доходит — глубину поднимает DEPTH_MIN, — но прямой вызов build даёт
  // сплошное основание, а не вывернутый наизнанку контур.
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (const [ax, ay] of [[WALL, ARM_Y], [ARM_X, WALL]]) {
        const x0 = i * W + ax + LEDGE
        const x1 = i * W + W - ax - LEDGE
        const y0 = j * D + ay + LEDGE
        const y1 = j * D + D - ay - LEDGE
        if (x1 > x0 && y1 > y0) base.push(hole(x0, y0, x1, y1))
      }
    }
  }

  // Стойки. Строятся по узлам сетки, а не по плиткам: в узле сходятся
  // уголки соседних плиток, и если складывать их поштучно, прямоугольники
  // соприкасаются рёбрами — а 2D-объединение в ядре такие пары молча теряет.
  // Поэтому узел сразу задаётся двумя планками, которые перекрываются в
  // середине: на краю сетки плечо обрезается до нуля, и планка становится
  // короче — так сами собой получаются крест, Т и Г.
  const posts = []

  for (let i = 0; i <= nx; i += 1) {
    for (let j = 0; j <= ny; j += 1) {
      const x = i * W
      const y = j * D
      const left = i > 0 ? ARM_X : 0
      const right = i < nx ? ARM_X : 0
      const down = j > 0 ? ARM_Y : 0
      const up = j < ny ? ARM_Y : 0
      const west = i > 0 ? WALL : 0
      const east = i < nx ? WALL : 0
      const south = j > 0 ? WALL : 0
      const north = j < ny ? WALL : 0

      span(posts, x - left, x + right, y - south, y + north)
      span(posts, x - west, x + east, y - down, y + up)
    }
  }

  return { base, posts, size }
}
