// Запуск генерации в воркере. ТЗ v3, разделы 13, 15.1, 16.
//
// Воркер создаётся на каждый запуск и завершается сразу после. Так прерывание
// по «Сбросить» и по тайм-ауту достаётся бесплатно: terminate убивает счёт
// на любой стадии, чего с общим воркером пришлось бы добиваться флагами.
// Цена — инициализация WASM на каждый запуск, десятки миллисекунд против
// секунд самого счёта.

import { GENERATION_TIMEOUT } from '../constants.js'

/** Причины, по которым генерация не дошла до конца. */
export const TIMEOUT = 'ERR-10'
export const CANCELLED = 'cancelled'

/**
 * @param {{ width: number, depth: number, nx: number, ny: number }} params
 * @returns {{ model: Promise<{ positions: Float32Array, indices: Uint32Array, bbox: object }>, cancel: () => void }}
 *   model отклоняется с TIMEOUT по истечении 15 с и с CANCELLED после cancel().
 */
export function generate(params) {
  const worker = new Worker(new URL('./build.worker.js', import.meta.url), { type: 'module' })

  let settle = null
  let timer = null

  // Первый исход выигрывает: дальше воркер уже мёртв, а промис разрешён.
  const stop = (outcome) => {
    if (settle === null) return
    const done = settle
    settle = null
    clearTimeout(timer)
    worker.terminate()
    done(outcome)
  }

  const model = new Promise((resolve, reject) => {
    settle = (outcome) => (outcome.error ? reject(new Error(outcome.error)) : resolve(outcome.model))
  })

  worker.onmessage = ({ data }) => stop(data.ok ? { model: data.model } : { error: data.message })
  worker.onerror = (event) => stop({ error: event.message ?? 'worker failed' })
  timer = setTimeout(() => stop({ error: TIMEOUT }), GENERATION_TIMEOUT)

  worker.postMessage(params)

  return { model, cancel: () => stop({ error: CANCELLED }) }
}
