// Корень приложения. ТЗ v5, разделы 2, 11, 19.
//
// Две колонки на всю высоту окна: слева карточка параметров, справа превью во
// всю оставшуюся площадь. Шагов нет — экран один, и модель в превью
// пересобирается после каждой завершённой правки.

import { useMemo, useReducer } from 'react'

import { reducer } from './state/reducer.js'
import { makeInitialState } from './state/initial.js'
import { useGeneration } from './state/useGeneration.js'
import { Panel } from './screens/Panel.jsx'
import { Preview } from './preview/Preview.jsx'
import { findPrinter, printField } from './printers.js'
import styles from './App.module.css'

/** Число в подпись: один знак после запятой, разделитель — запятая (ТЗ 5). */
const mm = (value) => value.toFixed(1).replace('.', ',')

/** Допуск сравнения габарита с полем: габарит приходит из меша, во float32. */
const EPS = 0.01

/**
 * Подпись описывает показанную модель, а не то, что сейчас в полях: после
 * правки параметров в превью остаётся старая модель (ТЗ 9.2, 11.4).
 *
 * Сетка берётся из снимка с конца: число размерных полей зависит от формы.
 */
function describe(model, snap, printer, over) {
  const [nx, ny] = snap.split('|').slice(-2)
  const { x, y, z } = model.bbox
  const size = `${mm(x)} × ${mm(y)} × ${mm(z)} мм · ${nx} × ${ny} ячейки`
  if (printer === null) return size
  const bed = `${size} · стол ${printer.bed.x} × ${printer.bed.y} мм`
  // Цвет контура — не единственный сигнал: он же сказан словами (ТЗ 7, 19).
  return over ? `${bed} · не помещается` : bed
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState)
  useGeneration(state, dispatch)

  // Стол рисуется только когда принтер выбран: при галочке «нет принтера»
  // стол неизвестен, рисовать нечего (ТЗ 11, блок H4).
  const printer = state.noPrinter ? null : findPrinter(state.printer)

  // Подставка крупнее полезного поля — не ошибка, а предупреждение: контур
  // стола краснеет (ТЗ 7). Сравнивается настоящий габарит построенной модели,
  // а не формула по полям: она бы разошлась с геометрией.
  const field = printer ? printField(state) : null
  const size = state.model?.bbox
  const over = Boolean(field && size && (size.x > field.x + EPS || size.y > field.y + EPS))

  const bed = useMemo(
    () => (printer ? { ...printer.bed, field: printField(state), over } : null),
    [printer, over],
  )
  const caption = state.model
    ? describe(state.model, state.modelSnapshot, printer, over)
    : null

  return (
    <main className={styles.app}>
      <div className={styles.column}>
        <Panel state={state} dispatch={dispatch} />
      </div>

      <Preview model={state.model} status={state.generation} caption={caption} bed={bed} />
    </main>
  )
}
