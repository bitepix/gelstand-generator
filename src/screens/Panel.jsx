// Панель параметров. ТЗ v3, разделы 2, 4, 6, 8, 19.
//
// Один компонент на все три шага: набор полей один, меняется только их
// видимость. Отдельной вёрстки под каждый экран нет — этого прямо требует
// раздел 19.
//
// Ошибки показываются не на каждое нажатие, а после завершения ввода или
// попытки перейти дальше (ТЗ 5.3). Иначе «19,» подсвечивалось бы красным
// прямо во время набора.

import { useState } from 'react'

import { Field } from '../ui/Field.jsx'
import { Select } from '../ui/Select.jsx'
import { Checkbox } from '../ui/Checkbox.jsx'
import { Notice } from '../ui/Notice.jsx'
import { SegmentedControl } from '../ui/SegmentedControl.jsx'
import { PrimaryButton } from '../ui/Buttons.jsx'
import { ErrorBlock } from '../ui/ErrorBlock.jsx'
import { validate } from '../validation/validate.js'
import { PRINTERS, printerLabel } from '../printers.js'
import { planFor } from '../grid/fit.js'
import { setField, normalizeField, next, setPrinter, toggleNoPrinter } from '../state/reducer.js'
import styles from './Panel.module.css'

const ERRORS_ID = 'params-errors'

const SIZES = [
  { field: 'width', label: 'Ширина, мм' },
  { field: 'depth', label: 'Глубина, мм' },
]

const JARS = [{ field: 'jars', label: 'Сколько у вас баночек' }]

const COUNTS = [
  { field: 'nx', label: 'Количество по X' },
  { field: 'ny', label: 'Количество по Y' },
]

const PRINTER_OPTIONS = PRINTERS.map((p) => ({ value: p.id, label: printerLabel(p) }))

/**
 * @param {object} props
 * @param {object} props.state
 * @param {Function} props.dispatch
 * @param {boolean} [props.locked]      поля заблокированы на время генерации
 * @param {React.ReactNode} [props.actions]  кнопки шага 3 вместо «Продолжить»
 */
export function Panel({ state, dispatch, locked = false, actions }) {
  const [showErrors, setShowErrors] = useState(false)
  const { errors, fields } = validate(state)
  const visible = showErrors ? errors : []

  const step = state.step
  // Плашка о делении — не ошибка: переход она не блокирует (ТЗ 16).
  const plan = step >= 2 ? planFor(state) : null
  const rows = step === 1 ? [...SIZES, ...JARS] : step === 2 ? COUNTS : [...SIZES, ...JARS, ...COUNTS]

  const change = (field, value) => dispatch(setField(field, value))
  const commit = (field, value) => {
    setShowErrors(true)
    dispatch(normalizeField(field, value))
  }

  // Проверка повторяется перед переходом, независимо от предыдущих (ТЗ 5.3).
  const forward = () => {
    setShowErrors(true)
    if (validate(state).errors.length === 0) dispatch(next())
  }

  return (
    <section className={styles.panel}>
      {step < 3 && <p className={styles.step}>Шаг {step} из 3</p>}

      <SegmentedControl
        shape={state.shape}
        disabled={locked}
        onChange={() => {}}
      />

      {step >= 2 && (
        <>
          <Select
            label="Принтер"
            placeholder="Выберите модель"
            value={state.printer}
            options={PRINTER_OPTIONS}
            disabled={locked || state.noPrinter}
            onChange={(id) => dispatch(setPrinter(id))}
          />
          <Checkbox
            label="У меня нет принтера"
            checked={state.noPrinter}
            disabled={locked}
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
        </>
      )}

      <div className={styles.grid}>
        {rows.map(({ field, label }) => (
          <Field
            key={field}
            field={field}
            label={label}
            value={state.fields[field]}
            error={showErrors && fields[field]}
            disabled={locked}
            describedBy={ERRORS_ID}
            onChange={change}
            onCommit={commit}
          />
        ))}
      </div>

      {plan !== null && plan.parts > 1 && (
        <Notice>
          Баночек больше, чем помещается на стол. Нужно {plan.parts} подставок
          по {plan.nx * plan.ny} ячеек — скачайте файл и напечатайте его {plan.parts} раз.
        </Notice>
      )}

      <ErrorBlock id={ERRORS_ID} codes={visible} />

      {actions ?? (
        <PrimaryButton disabled={visible.length > 0} onClick={forward}>
          Продолжить
        </PrimaryButton>
      )}
    </section>
  )
}
