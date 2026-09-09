// node --test    (встроенный раннер, зависимостей не требует)
//
// Сам воркер здесь не запускается — Worker браузерный. Проверяется обвязка:
// кто выигрывает гонку, снимается ли таймер, вызывается ли terminate.
import test from 'node:test'
import assert from 'node:assert/strict'

import { GENERATION_TIMEOUT } from '../src/constants.js'

/** Подставной Worker: сообщения шлём вручную, terminate считаем. */
class FakeWorker {
  static last = null

  constructor() {
    this.terminated = 0
    this.posted = []
    FakeWorker.last = this
  }

  postMessage(data) {
    this.posted.push(data)
  }

  terminate() {
    this.terminated += 1
  }
}

globalThis.Worker = FakeWorker
const { generate, TIMEOUT, CANCELLED } = await import('../src/worker/index.js')

const PARAMS = { width: 19.6, depth: 37, nx: 3, ny: 3 }

test('успех: модель приходит, воркер завершён, параметры отправлены', async () => {
  const run = generate(PARAMS)
  const worker = FakeWorker.last

  assert.deepEqual(worker.posted, [PARAMS])

  const model = { positions: new Float32Array(3), indices: new Uint32Array(3), bbox: {} }
  worker.onmessage({ data: { ok: true, model } })

  assert.equal(await run.model, model)
  assert.equal(worker.terminated, 1)
})

test('ошибка внутри воркера доходит сообщением', async () => {
  const run = generate(PARAMS)
  FakeWorker.last.onmessage({ data: { ok: false, message: 'profiles: width' } })

  await assert.rejects(run.model, { message: 'profiles: width' })
})

test('cancel прерывает и отклоняет промис', async () => {
  const run = generate(PARAMS)
  const worker = FakeWorker.last

  run.cancel()

  await assert.rejects(run.model, { message: CANCELLED })
  assert.equal(worker.terminated, 1)
})

test('тайм-аут 15 с даёт ERR-10', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const run = generate(PARAMS)
  const worker = FakeWorker.last

  t.mock.timers.tick(GENERATION_TIMEOUT)

  await assert.rejects(run.model, { message: TIMEOUT })
  assert.equal(worker.terminated, 1)
})

test('поздний ответ после cancel ничего не меняет', async () => {
  const run = generate(PARAMS)
  const worker = FakeWorker.last

  run.cancel()
  worker.onmessage({ data: { ok: true, model: {} } })
  run.cancel()

  await assert.rejects(run.model, { message: CANCELLED })
  assert.equal(worker.terminated, 1, 'terminate вызывается ровно один раз')
})
