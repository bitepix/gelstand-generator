// Третий шаг. ТЗ v4, разделы 9, 10, 15.
//
// Третий шаг содержит все параметры первых двух, поэтому панель здесь та же —
// меняется только набор действий под ней. Превью общее для всех шагов и живёт
// в App.

import { useState } from 'react'

import { Panel } from './Panel.jsx'
import { PrimaryButton, ResetButton } from '../ui/Buttons.jsx'
import { ErrorBlock } from '../ui/ErrorBlock.jsx'
import { ResetConfirm } from '../ui/ResetConfirm.jsx'
import { buttonState } from '../state/buttonState.js'
import { generateStart, reset } from '../state/reducer.js'
import { validate } from '../validation/validate.js'
import { export3MF } from '../export/threemf.js'
import { fileName } from '../export/fileName.js'
import styles from './Step3.module.css'

const LABEL = {
  download: 'Скачать',
  update: 'Обновить',
  disabled: 'Обновить',
  retry: 'Повторить',
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

  return (
    <div className={styles.step}>
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
