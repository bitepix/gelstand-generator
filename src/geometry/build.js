// Построение модели. ТЗ v3, разделы 12.3–12.5, контракт 14.2.
//
// Два выдавливания на всю модель: основание 0 … 1,2 и стойки 0 … 15,0.
// Объединение профилей делается на плоских контурах, до выдавливания —
// трёхмерных булевых операций, кроме одной сборки двух тел, нет.
//
// Скругления вертикальных рёбер — в round.js, на объединённых контурах.

import Module from 'manifold-3d'

import { BASE, HEIGHT } from '../constants.js'
import { profiles } from './profile.js'
import { roundCorners } from './round.js'

/** WASM инициализируется один раз на всё приложение. */
let ready = null

function manifold() {
  if (ready === null) {
    ready = Module().then((wasm) => {
      wasm.setup()
      return wasm
    })
  }
  return ready
}

/**
 * Контуры сечения со скруглёнными углами. toPolygons отдаёт точки объектами
 * {x, y}, round.js работает с парами [x, y] — здесь единственное место, где
 * форматы встречаются.
 */
function rounded(section) {
  return roundCorners(section.toPolygons().map((c) => c.map((p) => [p.x, p.y])))
}

/** Меш приходит во float32: 22,6 в нём хранится как 22,600000381. */
const mm = (value) => Math.round(value * 1000) / 1000

/** Позиции вершин как плотный Float32Array, без прочих атрибутов. */
function positionsOf(mesh) {
  const stride = mesh.numProp
  if (stride === 3) return new Float32Array(mesh.vertProperties)

  const count = mesh.vertProperties.length / stride
  const positions = new Float32Array(count * 3)
  for (let v = 0; v < count; v += 1) {
    positions[v * 3] = mesh.vertProperties[v * stride]
    positions[v * 3 + 1] = mesh.vertProperties[v * stride + 1]
    positions[v * 3 + 2] = mesh.vertProperties[v * stride + 2]
  }
  return positions
}

/**
 * Модель по параметрам. Асинхронна из-за загрузки WASM: первый вызов ждёт
 * инициализацию, последующие берут её из кэша.
 *
 * @param {{ width: number, depth: number, nx: number, ny: number }} params
 * @returns {Promise<{ positions: Float32Array, indices: Uint32Array, bbox: { x: number, y: number, z: number } }>}
 */
export async function build(params) {
  const { base, posts } = profiles(params)
  const { Manifold, CrossSection } = await manifold()

  // Fill rule Positive: контуры против часовой складываются, по часовой
  // вычитаются, наложения уголков соседних плиток схлопываются в объединение.
  // Поэтому попарных булевых операций на прямоугольниках не требуется.
  const baseRaw = new CrossSection(base, 'Positive')
  const postRaw = new CrossSection(posts, 'Positive')

  // Скругления вертикальных рёбер делаются после объединения контуров:
  // до него углов креста ещё не существует, они появляются на стыке плиток.
  const baseProfile = new CrossSection(rounded(baseRaw), 'Positive')
  const postProfile = new CrossSection(rounded(postRaw), 'Positive')

  const slab = Manifold.extrude(baseProfile, BASE)
  const walls = Manifold.extrude(postProfile, HEIGHT)
  const model = slab.add(walls)

  const mesh = model.getMesh()
  const box = model.boundingBox()

  const result = {
    positions: positionsOf(mesh),
    indices: new Uint32Array(mesh.triVerts),
    bbox: {
      x: mm(box.max[0] - box.min[0]),
      y: mm(box.max[1] - box.min[1]),
      z: mm(box.max[2] - box.min[2]),
    },
  }

  for (const object of [baseRaw, postRaw, baseProfile, postProfile, slab, walls, model]) object.delete()

  return result
}
