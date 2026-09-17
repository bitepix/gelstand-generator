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
import { toNumber } from '../validation/normalize.js'
import { SIZE_MAX, TEST_GRID } from '../constants.js'
import { buttonState } from '../state/buttonState.js'
import { paramsOf } from '../state/useGeneration.js'
import { generate } from '../worker/index.js'
import { PRINTERS, printerLabel } from '../printers.js'
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
  { field: 'nx', label: 'Количество по X' },
  { field: 'ny', label: 'Количество по Y' },
]

/**
 * Сколько баночек даёт заданная сетка. Люди считают баночками, а не сеткой,
 * поэтому произведение написано словами — отдельного поля для него нет
 * (ТЗ 6.3). Пока сетка не задана целиком, считать нечего.
 */
function jarsLine(fields) {
  const count = toNumber(fields.nx) * toNumber(fields.ny)
  if (!Number.isFinite(count) || count < 1) return null
  return `Сетка на ${count} ${plural(count, ['баночку', 'баночки', 'баночек'])}`
}

const PRINTER_OPTIONS = PRINTERS.map((p) => ({ value: p.id, label: printerLabel(p) }))

const LABEL = { download: 'Скачать', disabled: 'Скачать', loading: 'Скачать', retry: 'Повторить' }

function save(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Размеры годятся для тестовой подставки. Проверка своя, а не из validate:
 * ERR-05 и ERR-06 говорят про габарит всей сетки, а тестовая — всегда 3 × 3,
 * и она нужна как раз тогда, когда полная подставка на стол не влезла.
 */
const sizesReady = (state) =>
  SIZES[state.shape].every(({ field }) => {
    const value = toNumber(state.fields[field])
    return Number.isFinite(value) && value <= SIZE_MAX
  })

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
  const grid = jarsLine(state.fields)

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
    if (kind === 'download') return save(export3MF(state.model), fileName(state.fields, '3mf', state.shape))
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

      {SIZES[state.shape].map(({ field, label }) => (
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

      <div className={styles.test}>
        <button
          type="button"
          className={styles.testLink}
          disabled={busy || testing || !sizesReady(state)}
          onClick={downloadTest}
        >
          {testing ? 'Готовим тестовую подставку…' : `Скачать тестовую подставку ${TEST_GRID} × ${TEST_GRID}`}
        </button>
        <p className={styles.hint}>Напечатайте и проверьте, как садится баночка.</p>
      </div>
      <ErrorBlock id="test-error" codes={testError ? [testError] : []} />

      {COUNTS.map(({ field, label }) => (
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

      {grid && <p className={styles.hint}>{grid}</p>}

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
