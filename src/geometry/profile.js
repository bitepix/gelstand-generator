// Плоские профили плитки и сетки. ТЗ v3, разделы 12.3 и 12.4.
//
// Вся деталь описывается двумя плоскими фигурами — основанием и стойками, —
// и получается двумя выдавливаниями (12.4). Обе фигуры это наборы
// прямоугольников со сторонами по осям, поэтому здесь только арифметика.
//
// Модуль намеренно не зависит от manifold-3d: контуры считаются и
// проверяются без WASM, склейка и выдавливание — в build.js.

import { WALL, ARM_X, ARM_Y, PITCH_EXTRA } from '../constants.js'

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

  // Стойки. В каждом углу плитки уголок из двух прямоугольников ARM_X × WALL
  // и WALL × ARM_Y (12.3). Уголки соседних плиток в узле сетки складываются
  // в крест, на краю в Т, в углу в Г — отдельных алгоритмов для краёв не
  // нужно, достаточно объединения (12.1).
  const posts = []

  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      const x = i * W
      const y = j * D

      const x0 = x + ARM_X
      const x1 = x + W - ARM_X
      const y0 = y + ARM_Y
      const y1 = y + D - ARM_Y
      // Проёма нет, если плечи стоек сходятся. До интерфейса такая ячейка не
      // доходит — глубину поднимает DEPTH_MIN, — но прямой вызов build даёт
      // сплошное основание, а не вывернутый наизнанку контур.
      if (x1 > x0 && y1 > y0) base.push(hole(x0, y0, x1, y1))

      for (const [cx, dx] of [[x, 1], [x + W, -1]]) {
        for (const [cy, dy] of [[y, 1], [y + D, -1]]) {
          span(posts, cx, cx + dx * ARM_X, cy, cy + dy * WALL)
          span(posts, cx, cx + dx * WALL, cy, cy + dy * ARM_Y)
        }
      }
    }
  }

  return { base, posts, size }
}
