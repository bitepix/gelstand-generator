// Сверка плоских контуров с эталоном reference/hex/hexStand1.stl
import { readFileSync } from 'node:fs'
import { postContours, baseHole, hexOutline, hexMetrics } from '../src/geometry/hexCell.js'

const area = (c) => {
  let s = 0
  for (let i = 0; i < c.length; i += 1) {
    const [x0, y0] = c[i]
    const [x1, y1] = c[(i + 1) % c.length]
    s += x0 * y1 - x1 * y0
  }
  return s / 2
}

const d = readFileSync('reference/hex/hexStand1.stl')
const facets = d.readUInt32LE(80)
const tris = []
for (let i = 0; i < facets; i += 1) {
  const o = 84 + i * 50 + 12
  const v = []
  for (let k = 0; k < 9; k += 1) v.push(d.readFloatLE(o + k * 4))
  tris.push([v.slice(0, 3), v.slice(3, 6), v.slice(6, 9)])
}

/** Замкнутые контуры сечения эталона на высоте Z. */
function loopsAt(Z) {
  const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`
  const adj = new Map()
  for (const t of tris) {
    const pts = []
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const p = t[a]
      const q = t[b]
      if ((p[2] - Z) * (q[2] - Z) < 0) {
        const f = (Z - p[2]) / (q[2] - p[2])
        pts.push([p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])])
      }
    }
    if (pts.length !== 2) continue
    for (const [a, b] of [[0, 1], [1, 0]]) {
      const k = key(pts[a])
      if (!adj.has(k)) adj.set(k, { p: pts[a], to: [] })
      adj.get(k).to.push(pts[b])
    }
  }
  const seen = new Set()
  const loops = []
  for (const [k, node] of adj) {
    if (seen.has(k)) continue
    const loop = [node.p]
    seen.add(k)
    let cur = node
    for (;;) {
      const next = cur.to.map((p) => adj.get(key(p))).find((x) => x && !seen.has(key(x.p)))
      if (!next) break
      seen.add(key(next.p))
      loop.push(next.p)
      cur = next
    }
    if (loop.length > 2) loops.push(loop)
  }
  return loops
}

const sliceArea = (Z) => loopsAt(Z).reduce((s, l) => s + Math.abs(area(l)) * (Math.abs(area(l)) > 0 ? 1 : 0), 0)
const sliceSigned = (Z) => {
  const ls = loopsAt(Z).map((l) => Math.abs(area(l)))
  const total = Math.max(...ls)
  const holes = ls.filter((a) => a !== total).reduce((s, a) => s + a, 0)
  return { total, holes, net: total - holes, parts: ls.length }
}

const D = 50
console.log('метрики:', hexMetrics(D))
console.log()
for (const [label, dd, Z] of [['подошва', 0.48, 0.02], ['середина фаски', 0.25, 0.25], ['стойка', 0, 3.0], ['стойка', 0, 10.0], ['верх', -0.25, 14.75], ['верх', -0.48, 14.98]]) {
  const mine = postContours(D, dd).reduce((s, c) => s + area(c), 0)
  const ref = sliceArea(Z)
  console.log(`${label.padEnd(8)} d=${String(dd).padStart(4)}  мой ${mine.toFixed(3)}  эталон(z=${Z}) ${ref.toFixed(3)}  Δ ${(100 * (mine - ref) / ref).toFixed(3)} %`)
}
const hole = -area(baseHole(D))
const hex = area(hexOutline(D))
const ref = sliceSigned(-0.6)
console.log()
console.log(`основание: мой ${(hex - hole).toFixed(3)} = ${hex.toFixed(3)} − ${hole.toFixed(3)}`)
console.log(`           эталон ${ref.net.toFixed(3)} = ${ref.total.toFixed(3)} − ${ref.holes.toFixed(3)}, контуров ${ref.parts}`)
console.log(`           Δ ${(100 * (hex - hole - ref.net) / ref.net).toFixed(3)} %`)
