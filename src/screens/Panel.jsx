// Единственный экран приложения. ТЗ v5, разделы 2, 4, 6, 9, 10, 15, 19.
//
// Шагов нет: все параметры на виду сразу, превью живое. Панель разбита на три
// пронумерованных раздела — размеры, сетка, принтер. Заголовок раздела
// заменяет подписи полей, поэтому у самих полей видимой подписи нет, только
// aria-label (см. Field).
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
import { toNumber } from '../validation/normalize.js'
import { SIZE_MAX, TEST_GRID } from '../constants.js'
import { buttonState } from '../state/buttonState.js'
import { paramsOf } from '../state/useGeneration.js'
import { generate } from '../worker/index.js'
import { PRINTERS, printerLabel } from '../printers.js'
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
    { field: 'width', label: 'Ширина баночки, мм' },
    { field: 'depth', label: 'Глубина баночки, мм' },
  ],
  round: [{ field: 'diameter', label: 'Диаметр баночки, мм' }],
}

const COUNTS = [
  { field: 'nx', label: 'Количество ячеек по X' },
  { field: 'ny', label: 'Количество ячеек по Y' },
]

const PRINTER_OPTIONS = PRINTERS.map((p) => ({ value: p.id, label: printerLabel(p) }))

const LABEL = {
  download: 'Скачать .3mf',
  disabled: 'Скачать .3mf',
  loading: 'Скачать .3mf',
  retry: 'Повторить',
}

function save(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Размеры годятся для тестовой подставки: заполнены и не больше 100 мм.
 * Величина сетки тестовую не касается — она всегда 3 × 3.
 */
const sizesReady = (state) =>
  SIZES[state.shape].every(({ field }) => {
    const value = toNumber(state.fields[field])
    return Number.isFinite(value) && value <= SIZE_MAX
  })

/** Сколько ячеек даёт заданная сетка. Пока она не задана целиком — ничего. */
function cellCount(fields) {
  const count = toNumber(fields.nx) * toNumber(fields.ny)
  return Number.isFinite(count) && count >= 1 ? count : null
}

/** @param {{ state: object, dispatch: Function }} props */
export function Panel({ state, dispatch }) {
  const [showErrors, setShowErrors] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState(null)

  const { errors, fields } = validate(state)
  const visible = showErrors ? errors : []

  const kind = buttonState(state)
  const busy = kind === 'loading'
  const cells = cellCount(state.fields)

  const change = (field, value) => dispatch(setField(field, value))
  const commit = (field, value) => {
    setShowErrors(true)
    dispatch(normalizeField(field, value))
  }

  /**
   * Тестовая подставка: та же геометрия с теми же размерами ячейки, но сеткой
   * 3 × 3 — маленькая печать, чтобы проверить посадку баночки до полной
   * подставки. Считается отдельным прогоном и в превью не попадает (ТЗ 4.3).
   */
  const downloadTest = async () => {
    if (testing) return
    setTesting(true)
    setTestError(null)
    try {
      const model = await generate({ ...paramsOf(state), nx: TEST_GRID, ny: TEST_GRID }).model
      const grid = String(TEST_GRID)
      save(export3MF(model), fileName({ ...state.fields, nx: grid, ny: grid }, '3mf', state.shape))
    } catch {
      setTestError('ERR-08')
    } finally {
      setTesting(false)
    }
  }

  const act = () => {
    if (kind === 'download') {
      return save(export3MF(state.model), fileName(state.fields, '3mf', state.shape))
    }
    // Повтор после технической ошибки: параметры проверяются заново (ТЗ 5.3).
    setShowErrors(true)
    if (validate(state).errors.length === 0) dispatch(generateStart())
  }

  const field = ({ field: name, label }, suffix) => (
    <Field
      key={name}
      field={name}
      label={label}
      suffix={suffix}
      value={state.fields[name]}
      error={showErrors && fields[name]}
      disabled={busy}
      describedBy={ERRORS_ID}
      onChange={change}
      onCommit={commit}
    />
  )

  return (
    <section className={styles.panel}>
      <SegmentedControl
        shape={state.shape}
        disabled={busy}
        onChange={(shape) => dispatch(setShape(shape))}
      />

      <div className={styles.section}>
        <h2 className={styles.heading}>1. Введите размеры баночки</h2>
        <div className={styles.row}>{SIZES[state.shape].map((row) => field(row, 'мм'))}</div>
        <p className={styles.hint}>
          Учитывайте погрешность 3D-печати: прибавьте к каждому размеру 0,2 – 0,4 мм.
          Перед печатью скачайте{' '}
          <button
            type="button"
            className={styles.testLink}
            disabled={busy || testing || !sizesReady(state)}
            onClick={downloadTest}
          >
            {testing ? 'тестовый файл…' : 'тестовый файл'}
          </button>{' '}
          для проверки
        </p>
        <ErrorBlock id="test-error" codes={testError ? [testError] : []} />
      </div>

      <div className={styles.section}>
        <h2 className={styles.heading}>2. Сетка</h2>
        <div className={styles.row}>{COUNTS.map((row) => field(row))}</div>
        {cells !== null && <p className={styles.hint}>Количество ячеек: {cells} шт.</p>}
      </div>

      <div className={styles.section}>
        <h2 className={styles.heading}>3. Принтер</h2>
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
            <b>5% скидка</b> по промокоду <b>NAILMOD5</b> в магазине{' '}
            <a href="https://3d-outlet.com/" target="_blank" rel="noreferrer">
              3d-outlet.com
            </a>
          </Notice>
        )}
      </div>

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
