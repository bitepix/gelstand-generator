// Построение модели. ТЗ v3, разделы 12.3–12.5, контракт 14.2.
//
// Основание выдавливается один раз. Стойки собираются из трёх слоёв по Z:
// фаска у подошвы, прямое тело, фаска сверху. Объединение профилей по-прежнему
// делается на плоских контурах — трёхмерных булевых операций ровно столько,
// сколько слоёв.
//
// Скругления вертикальных рёбер — в round.js, фаски горизонтальных — в
// chamfer.js. Оба работают с контурами и не зависят от manifold-3d.

import Module from 'manifold-3d'

import { BASE, HEIGHT, CHAMFER_FOOT, CHAMFER_TOP } from '../constants.js'
import { profiles } from './profile.js'
import { roundCorners } from './round.js'
import { chamferRing, offsetContour } from './chamfer.js'

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

/** Меш приходит во float32: 22,6 в нём хранится как 22,600000381. */
const mm = (value) => Math.round(value * 1000) / 1000

/** Площадь контура со знаком: против часовой — плюс, по часовой — минус. */
function area(contour) {
  let sum = 0
  for (let i = 0; i < contour.length; i += 1) {
    const [x0, y0] = contour[i]
    const [x1, y1] = contour[(i + 1) % contour.length]
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}

/**
 * Контуры сечения со скруглёнными углами. toPolygons отдаёт точки объектами
 * {x, y}, round.js работает с парами [x, y] — здесь единственное место, где
 * форматы встречаются.
 */
function rounded(section) {
  return roundCorners(section.toPolygons().map((c) => c.map((p) => [p.x, p.y])))
}

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
 * Слой с фаской: кольцо скоса плюс прямое ядро внутри него.
 *
 * @param {object} wasm
 * @param {number[][][]} wide   контуры на нижнем, широком уровне
 * @param {number} z0
 * @param {number} z1
 * @param {number} delta        насколько верх уже низа
 */
function chamferLayer({ Manifold, CrossSection }, wide, z0, z1, delta, trash) {
  const ring = Manifold.ofMesh(chamferRing(wide, z0, z1, delta))
  const narrow = new CrossSection(wide.map((c) => offsetContour(c, delta)), 'Positive')
  const core = Manifold.extrude(narrow, z1 - z0).translate([0, 0, z0])
  const layer = ring.add(core)
  trash.push(ring, narrow, core)
  return layer
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
  const wasm = await manifold()
  const { Manifold, CrossSection } = wasm
  const trash = []

  const baseRaw = new CrossSection(base, 'Positive')
  const postRaw = new CrossSection(posts, 'Positive')

  // Скругления вертикальных рёбер делаются после объединения контуров:
  // до него углов креста ещё не существует, они появляются на стыке плиток.
  const basePolys = rounded(baseRaw)
  const postPolys = rounded(postRaw)
  trash.push(baseRaw, postRaw)

  const baseProfile = new CrossSection(basePolys, 'Positive')
  const postProfile = new CrossSection(postPolys, 'Positive')
  trash.push(baseProfile, postProfile)

  const footTop = BASE + CHAMFER_FOOT // 1,7
  const capBottom = HEIGHT - CHAMFER_TOP // 14,5

  const slab = Manifold.extrude(baseProfile, BASE)
  const shaft = Manifold.extrude(postProfile, capBottom - footTop).translate([0, 0, footTop])

  // Фаска у подошвы: внизу стойка шире на CHAMFER_FOOT, кверху сходится к
  // своему контуру. Наружу она вылезает за край плиты — обрезается габаритом.
  const footWide = postPolys.map((c) => offsetContour(c, -CHAMFER_FOOT))
  const foot = chamferLayer(wasm, footWide, BASE, footTop, CHAMFER_FOOT, trash)

  // Фаска сверху: с уровня 14,5 стойка сужается к 15,0.
  const cap = chamferLayer(wasm, postPolys, capBottom, HEIGHT, CHAMFER_TOP, trash)

  // Габарит задаёт внешний контур основания. Фаска подошвы снаружи срезается
  // им же: на краю плиты стенка идёт вертикально до самого низа.
  const outline = new CrossSection(basePolys.filter((c) => area(c) > 0), 'Positive')
  const bound = Manifold.extrude(outline, HEIGHT)
  const model = Manifold.union([slab, shaft, foot, cap]).intersect(bound)
  trash.push(slab, shaft, foot, cap, outline, bound, model)

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

  for (const object of trash) object.delete()

  return result
}
