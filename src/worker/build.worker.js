// Воркер генерации. ТЗ v3, раздел 13.
//
// Худший случай — 38 × 33 ячейки при минимальном размере — считается 4,5 с.
// В основном потоке это заморозило бы интерфейс: ни лоадера, ни сброса.

import wasmUrl from 'manifold-3d/manifold.wasm?url'

import { build, setWasmUrl } from '../geometry/build.js'

setWasmUrl(wasmUrl)

self.onmessage = async ({ data }) => {
  try {
    const model = await build(data)
    // Буферы отдаются без копирования: на максимальной сетке это 4,8 МБ.
    self.postMessage({ ok: true, model }, [model.positions.buffer, model.indices.buffer])
  } catch (error) {
    self.postMessage({ ok: false, message: String(error?.message ?? error) })
  }
}
