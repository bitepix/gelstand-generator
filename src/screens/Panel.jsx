// Единственный экран приложения. ТЗ v5, разделы 2, 4, 6, 9, 10, 15, 19.
//
// Шагов больше нет: все параметры на виду сразу, превью живое. Поэтому и
// экран один — карточка в левой колонке, а справа модель, которая
// пересобирается после каждой завершённой правки.
//
// Ошибки показываются не на каждое нажатие, а после завершения ввода
// (ТЗ 5.3). Иначе «19,» подсвечивалось бы красным прямо во время набора.

import { useState } from 'react'

import { Field } from '../ui/Field.jsx'
import { Select } from '../ui/Select.jsx'
import { Checkbox } from '../ui/Checkbox.jsx'
import { Notice } from '../ui/Notice.jsx'
import { SegmentedControl } from '../ui/SegmentedControl.jsx'
import { PrimaryButton, ResetButton } from '../ui/Buttons.jsx'
import { ErrorBlock } from '../ui/ErrorBlock.jsx'
import { ResetConfirm } from '../ui/ResetConfirm.jsx'
import { validate } from '../validation/validate.js'
import { buttonState } from '../state/buttonState.js'
import { PRINTERS, printerLabel } from '../printers.js'
import { planFor } from '../grid/fit.js'
import { plural } from '../validation/plural.js'
import { export3MF } from '../export/threemf.js'
import { fileName } from '../export/fileName.js'
import {
  setField,
  normalizeField,
  setShape,
  setPrinter,
  toggleNoPrinter,
  generateStart,
  reset,
} from '../state/reducer.js'
import styles from './Panel.module.css'

const ERRORS_ID = 'params-errors'

// Размерные поля зависят от формы ячейки: у круглой один диаметр вместо
// ширины и глубины (ТЗ 1.1).
const SIZES = {
  rect: [
    { field: 'width', label: 'Ширина, мм' },
    { field: 'depth', label: 'Глубина, мм' },
  ],
  round: [{ field: 'diameter', label: 'Диаметр баночки, мм' }],
}

const COUNTS = [
  { field: 'jars', label: 'Сколько у вас баночек' },
  { field: 'nx', label: 'Количество по X' },
  { field: 'ny', label: 'Количество по Y' },
]

const PRINTER_OPTIONS = PRINTERS.map((p) => ({ value: p.id, label: printerLabel(p) }))

const LABEL = { download: 'Скачать', disabled: 'Скачать', loading: 'Скачать', retry: 'Повторить' }

function download(state) {
  const blob = export3MF(state.model)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName(state.fields, '3mf', state.shape)
  link.click()
  URL.revokeObjectURL(url)
}

/** @param {{ state: object, dispatch: Function }} props */
export function Panel({ state, dispatch }) {
  const [showErrors, setShowErrors] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const { errors, fields } = validate(state)
  const visible = showErrors ? errors : []

  const kind = buttonState(state)
  const busy = kind === 'loading'
  // Плашка о делении — не ошибка: скачивание она не блокирует (ТЗ 16).
  const plan = planFor(state)
  const rows = [...SIZES[state.shape], ...COUNTS]

  const change = (field, value) => dispatch(setField(field, value))
  const commit = (field, value) => {
    setShowErrors(true)
    dispatch(normalizeField(field, value))
  }

  const act = () => {
    if (kind === 'download') return download(state)
    // Повтор после технической ошибки: параметры проверяются заново (ТЗ 5.3).
    setShowErrors(true)
    if (validate(state).errors.length === 0) dispatch(generateStart())
  }

  return (
    <section className={styles.panel}>
      <SegmentedControl
        shape={state.shape}
        disabled={busy}
        onChange={(shape) => dispatch(setShape(shape))}
      />

      <Select
        label="Принтер"
        placeholder="Выберите модель"
        value={state.printer}
        options={PRINTER_OPTIONS}
        disabled={busy || state.noPrinter}
        onChange={(id) => dispatch(setPrinter(id))}
      />
      <Checkbox
        label="У меня нет принтера"
        checked={state.noPrinter}
        disabled={busy}
        onChange={() => dispatch(toggleNoPrinter())}
      />
      {state.noPrinter && (
        <Notice kind="offer">
          Купить 3D-принтер можно в магазине{' '}
          <a href="https://3d-outlet.com/" target="_blank" rel="noreferrer">
            3d-outlet.com
          </a>
          , промокод <b>NAILMOD5</b> даёт 5% скидки.
        </Notice>
      )}

      {rows.map(({ field, label }) => (
        <Field
          key={field}
          field={field}
          label={label}
          value={state.fields[field]}
          error={showErrors && fields[field]}
          disabled={busy}
          describedBy={ERRORS_ID}
          onChange={change}
          onCommit={commit}
        />
      ))}

      {plan !== null && plan.parts > 1 && (
        <Notice>
          Баночек больше, чем помещается на стол. Нужно {plan.parts}{' '}
          {plural(plan.parts, ['подставка', 'подставки', 'подставок'])} по {plan.nx * plan.ny}{' '}
          {plural(plan.nx * plan.ny, ['ячейке', 'ячейки', 'ячеек'])} — скачайте файл и
          напечатайте его {plan.parts} {plural(plan.parts, ['раз', 'раза', 'раз'])}.
        </Notice>
      )}

      <ErrorBlock id={ERRORS_ID} codes={visible} />
      <ErrorBlock
        id="generation-error"
        codes={state.generationError ? [state.generationError] : []}
      />

      <div className={styles.actions}>
        <PrimaryButton loading={busy} disabled={kind === 'disabled'} onClick={act}>
          {LABEL[kind]}
        </PrimaryButton>
        {/* Сброс доступен всегда, включая время генерации (ТЗ 15.1). */}
        <ResetButton onClick={() => setConfirming(true)} />
      </div>

      <ResetConfirm
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          dispatch(reset())
        }}
      />
    </section>
  )
}
