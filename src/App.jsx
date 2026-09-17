// Корень приложения. ТЗ v4, разделы 2, 11, 19.
//
// Две колонки на всю высоту окна: слева узкая карточка параметров, справа
// превью во всю оставшуюся площадь. Превью живёт здесь, а не внутри шага:
// оно на месте с первого шага, меняются только параметры слева.

import { useMemo, useReducer } from 'react'

import { reducer } from './state/reducer.js'
import { makeInitialState } from './state/initial.js'
import { useGeneration } from './state/useGeneration.js'
import { Panel } from './screens/Panel.jsx'
import { Step3 } from './screens/Step3.jsx'
import { Preview } from './preview/Preview.jsx'
import { findPrinter, printField } from './printers.js'
import styles from './App.module.css'

/** Число в подпись: один знак после запятой, разделитель — запятая (ТЗ 5). */
const mm = (value) => value.toFixed(1).replace('.', ',')

/**
 * Подпись описывает показанную модель, а не то, что сейчас в полях: после
 * правки параметров в превью остаётся старая модель (ТЗ 9.2, 11.4).
 *
 * Сетка берётся из снимка с конца: число размерных полей зависит от формы.
 */
function describe(model, snap, printer) {
  const [nx, ny] = snap.split('|').slice(-2)
  const { x, y, z } = model.bbox
  const size = `${mm(x)} × ${mm(y)} × ${mm(z)} мм · ${nx} × ${ny} ячейки`
  return printer ? `${size} · стол ${printer.bed.x} × ${printer.bed.y} мм` : size
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState)
  useGeneration(state, dispatch)

  // Стол рисуется только когда принтер выбран: при галочке «нет принтера»
  // стол неизвестен, рисовать нечего (ТЗ 11, блок H4).
  const printer = state.noPrinter ? null : findPrinter(state.printer)
  const bed = useMemo(
    () => (printer ? { ...printer.bed, field: printField(state) } : null),
    [printer, state.noPrinter],
  )
  const caption = state.model ? describe(state.model, state.modelSnapshot, printer) : null

  return (
    <main className={styles.app} data-step={state.step}>
      <div className={styles.column}>
        {state.step === 3 ? (
          <Step3 state={state} dispatch={dispatch} />
        ) : (
          <Panel state={state} dispatch={dispatch} />
        )}
      </div>

      <Preview model={state.model} status={state.generation} caption={caption} bed={bed} />
    </main>
  )
}
