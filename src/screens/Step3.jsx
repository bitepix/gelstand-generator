// Третий шаг. ТЗ v3, разделы 9, 10, 11, 15.
//
// Третий шаг содержит все параметры первых двух, поэтому панель здесь та же —
// меняется только набор действий под ней.

import { useMemo, useState } from 'react'

import { Preview } from '../preview/Preview.jsx'
import { Panel } from './Panel.jsx'
import { PrimaryButton, ResetButton } from '../ui/Buttons.jsx'
import { ErrorBlock } from '../ui/ErrorBlock.jsx'
import { ResetConfirm } from '../ui/ResetConfirm.jsx'
import { buttonState } from '../state/buttonState.js'
import { generateStart, reset } from '../state/reducer.js'
import { validate } from '../validation/validate.js'
import { findPrinter, printField } from '../printers.js'
import { export3MF } from '../export/threemf.js'
import { fileName } from '../export/fileName.js'
import styles from './Step3.module.css'

const LABEL = {
  download: 'Скачать',
  update: 'Обновить',
  disabled: 'Обновить',
  retry: 'Повторить',
}

/** Число в подпись: один знак после запятой, разделитель — запятая (ТЗ 5). */
const mm = (value) => value.toFixed(1).replace('.', ',')

function describe(model, snap, printer) {
  // Снимок начинается с формы, дальше идут размеры — их число зависит от
  // формы, поэтому сетка берётся с конца.
  const [nx, ny] = snap.split('|').slice(-2)
  const { x, y, z } = model.bbox
  const size = `${mm(x)} × ${mm(y)} × ${mm(z)} мм · ${nx} × ${ny} ячейки`
  return printer ? `${size} · стол ${printer.bed.x} × ${printer.bed.y} мм` : size
}

function download(state) {
  const blob = export3MF(state.model)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName(state.fields, '3mf', state.shape)
  link.click()
  URL.revokeObjectURL(url)
}

export function Step3({ state, dispatch }) {
  const [confirming, setConfirming] = useState(false)

  const kind = buttonState(state)
  const busy = kind === 'loading'
  // На время генерации кнопка держит тот текст, к которому идёт дело.
  const label = busy ? (state.model ? 'Обновить' : 'Скачать') : LABEL[kind]

  const act = () => {
    if (kind === 'download') return download(state)
    // Параметры проверяются заново перед каждым запуском (ТЗ 5.3).
    if (validate(state).errors.length === 0) dispatch(generateStart())
  }

  // Подпись описывает показанную модель, а не то, что сейчас в полях: после
  // правки параметров в превью остаётся старая модель (ТЗ 9.2, 11.4).
  // Стол рисуется только когда принтер выбран: при галочке «нет принтера»
  // стол неизвестен, рисовать нечего (ТЗ 11, блок H4).
  const printer = state.noPrinter ? null : findPrinter(state.printer)
  const bed = useMemo(
    () => (printer ? { ...printer.bed, field: printField(state) } : null),
    [printer, state.noPrinter],
  )

  const caption = state.model ? describe(state.model, state.modelSnapshot, printer) : null

  return (
    <div className={styles.step}>
      <Preview model={state.model} status={state.generation} caption={caption} bed={bed} />

      <ErrorBlock id="generation-error" codes={state.generationError ? [state.generationError] : []} />

      <Panel
        state={state}
        dispatch={dispatch}
        locked={busy}
        actions={
          <div className={styles.actions}>
            <PrimaryButton loading={busy} disabled={kind === 'disabled'} onClick={act}>
              {label}
            </PrimaryButton>
            {/* Сброс доступен всегда, включая время генерации (ТЗ 15.1). */}
            <ResetButton onClick={() => setConfirming(true)} />
          </div>
        }
      />

      <ResetConfirm
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          dispatch(reset())
        }}
      />
    </div>
  )
}
