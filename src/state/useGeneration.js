// Запуск генерации по состоянию. ТЗ v3, разделы 8, 9, 16.
//
// Единственная точка, где приложение обращается к воркеру: как только дерево
// состояния переходит в 'pending', начинается счёт, а уход из 'pending' или
// размонтирование его прерывают.

import { useEffect } from 'react'

import { generate, TIMEOUT, CANCELLED } from '../worker/index.js'
import { toNumber } from '../validation/normalize.js'
import { generateOk, generateFail } from './reducer.js'
import { snapshot } from './snapshot.js'

export function useGeneration(state, dispatch) {
  const pending = state.generation === 'pending'

  useEffect(() => {
    if (!pending) return undefined

    // Параметры и снимок фиксируются на момент запуска: поля на время
    // генерации заблокированы, но состояние всё равно не должно разъехаться
    // с тем, что посчитано.
    const params = {
      width: toNumber(state.fields.width),
      depth: toNumber(state.fields.depth),
      nx: toNumber(state.fields.nx),
      ny: toNumber(state.fields.ny),
    }
    const snap = snapshot(state)
    const hadModel = state.model !== null

    const run = generate(params)
    let alive = true

    run.model.then(
      (model) => {
        if (alive) dispatch(generateOk(model, snap))
      },
      (error) => {
        // Прерывание по «Сбросить» ошибкой не является.
        if (!alive || error.message === CANCELLED) return
        if (error.message === TIMEOUT) dispatch(generateFail(TIMEOUT))
        else dispatch(generateFail(hadModel ? 'ERR-09' : 'ERR-08'))
      },
    )

    return () => {
      alive = false
      run.cancel()
    }
    // Намеренно только pending: перезапускать счёт на каждое изменение полей
    // нельзя — изменение параметров генерацию не запускает (ТЗ 9.2).
  }, [pending]) // eslint-disable-line react-hooks/exhaustive-deps
}
