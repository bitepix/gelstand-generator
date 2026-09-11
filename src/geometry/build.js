// Построение модели. Геометрия сверена с reference/ta2-1.step, разбор —
// в reference/README.md.
//
// Вся деталь — четыре горизонтальных сечения и два скоса между ними, и
// считается она целиком на плоских контурах (outline.js). Ядру остаются
// четыре выдавливания и одно объединение.
//
// Скосы фасок — это выдавливание с переносом верхних вершин: три контура
// стойки заданы с одинаковым числом вершин и в одном порядке, поэтому
// каждой вершине нижнего сечения отвечает ровно одна вершина верхнего.
//
// B-Rep-ядро (brepjs + occt-wasm) эту же модель строит точно так же верно,
// но одна склейка сетки 8 × 4 занимает 45 с при тайм-ауте 15 — см. PROGRESS.

import Module from 'manifold-3d'

import { BASE, HEIGHT, CHAMFER_FOOT, CHAMFER_TOP } from '../constants.js'
import { profiles } from './profile.js'
import { outlines } from './outline.js'

/** WASM инициализируется один раз на всё приложение. */
let ready = null

/**
 * Адрес manifold.wasm. В браузере его даёт сборщик: сам manifold ищет файл
 * рядом со своим модулем, а внутри воркера это не тот адрес — dev-сервер
 * отвечал на такой запрос страницей, и WebAssembly падал на «expected magic
 * word». В node путь не нужен, поэтому значение приходит снаружи, а не
 * импортом: `?url` понимает только Vite, и проверочные скрипты на нём бы
 * сломались.
 */
let wasmUrl = null

export function setWasmUrl(url) {
  wasmUrl = url
}

export function warmUp() {
  if (ready === null) {
    ready = Module(wasmUrl ? { locateFile: () => wasmUrl } : {}).then((wasm) => {
      wasm.setup()
      return wasm
    })
  }
  return ready
}

/**
 * toPolygons отдаёт точки объектами и во float32: 67,8 возвращается как
 * 67,800003. Округление до микрона возвращает им ровные значения — иначе
 * рёбра на габарите перестают опознаваться и фаска выезжает за деталь.
 */
const µm = (v) => Math.round(v * 1e4) / 1e4
const pairs = (contour) => contour.map((p) => (Array.isArray(p) ? [µm(p[0]), µm(p[1])] : [µm(p.x), µm(p.y)]))

const key = (x, y) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`

/**
 * Стойки целиком: столб, у которого сечение меняется по высоте.
 *
 * Уровни задаются набором контуров, у всех одинаковое число вершин и один
 * порядок, поэтому боковина — это просто лента четырёхугольников между
 * соседними уровнями. Крышки триангулирует manifold.
 *
 * Через warp то же самое не выходит: manifold хранит координаты во float32,
 * и вершины после выдавливания не находятся по своему же ключу.
 */
function column(wasm, levels) {
  const { Manifold, Mesh, triangulate } = wasm
  const rings = levels.map((l) => l.rings)
  const zs = levels.map((l) => l.z)
  const counts = rings[0].map((c) => c.length)
  const total = counts.reduce((a, b) => a + b, 0)

  const verts = new Float32Array(total * rings.length * 3)
  let at = 0
  for (let k = 0; k < rings.length; k += 1) {
    for (const contour of rings[k]) {
      for (const [x, y] of contour) {
        verts[at * 3] = x
        verts[at * 3 + 1] = y
        verts[at * 3 + 2] = zs[k]
        at += 1
      }
    }
  }

  const tris = []
  // Боковина: по ленте на каждый промежуток между уровнями.
  for (let k = 0; k + 1 < rings.length; k += 1) {
    let start = 0
    for (let c = 0; c < counts.length; c += 1) {
      const n = counts[c]
      const lo = k * total + start
      const up = (k + 1) * total + start
      for (let i = 0; i < n; i += 1) {
        const j = (i + 1) % n
        tris.push(lo + i, lo + j, up + i, lo + j, up + j, up + i)
      }
      start += n
    }
  }
  // Крышки: нижняя смотрит вниз, поэтому обход разворачивается.
  const bottom = triangulate(rings[0])
  for (const [a, b, c] of bottom) tris.push(a, c, b)
  const topAt = (rings.length - 1) * total
  for (const [a, b, c] of triangulate(rings[rings.length - 1])) {
    tris.push(topAt + a, topAt + b, topAt + c)
  }

  const mesh = new Mesh({ numProp: 3, vertProperties: verts, triVerts: new Uint32Array(tris) })
  mesh.merge()
  return Manifold.ofMesh(mesh)
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
 * Тело модели. Отдельно от build, чтобы проверочные скрипты могли считать
 * объём и сечения, не превращая модель в меш.
 */
export function solidOf(wasm, params) {
  const { Manifold, CrossSection } = wasm
  const { base, posts, size } = profiles(params)

  // Fill rule Positive: контуры против часовой складываются, по часовой
  // вычитаются, наложения планок в узле схлопываются в объединение.
  const baseRaw = new CrossSection(base, 'Positive')
  const postRaw = new CrossSection(posts, 'Positive')
  const sharp = {
    base: baseRaw.toPolygons().map(pairs),
    posts: postRaw.toPolygons().map(pairs),
  }
  baseRaw.delete()
  postRaw.delete()

  const o = outlines(sharp, size)

  const parts = [
    Manifold.extrude(o.slab, BASE),
    column(wasm, [
      { z: BASE, rings: o.foot },
      { z: BASE + CHAMFER_FOOT, rings: o.post },
      { z: HEIGHT - CHAMFER_TOP, rings: o.post },
      { z: HEIGHT, rings: o.top },
    ]),
  ]

  const model = Manifold.union(parts)
  for (const part of parts) part.delete()
  return model
}

/**
 * Модель по параметрам. Асинхронна из-за загрузки WASM: первый вызов ждёт
 * инициализацию, последующие берут её из кэша.
 *
 * @param {{ width: number, depth: number, nx: number, ny: number }} params
 * @returns {Promise<{ positions: Float32Array, indices: Uint32Array, bbox: { x: number, y: number, z: number } }>}
 */
export async function build(params) {
  const wasm = await warmUp()
  const model = solidOf(wasm, params)

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

  model.delete()
  return result
}
