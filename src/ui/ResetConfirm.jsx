// Подтверждение сброса. ТЗ v3, раздел 15.1.
//
// Нативный <dialog> с showModal: ловушка фокуса, закрытие по Esc и подложка
// достаются от браузера. Своя реализация модалки была бы втрое длиннее и
// хуже по доступности.

import { useEffect, useRef } from 'react'

import styles from './ResetConfirm.module.css'

/** @param {{ open: boolean, onConfirm: () => void, onCancel: () => void }} props */
export function ResetConfirm({ open, onConfirm, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="reset-title"
      // Esc: закрываем через состояние, иначе dialog закроется сам и разойдётся
      // с тем, что думает приложение.
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h2 id="reset-title" className={styles.title}>
        Сбросить генератор?
      </h2>
      <p className={styles.text}>
        Модель и введённые значения будут удалены, генератор вернётся к первому шагу.
        Отменить это действие нельзя.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Отмена
        </button>
        <button type="button" className={styles.confirm} onClick={onConfirm}>
          Сбросить
        </button>
      </div>
    </dialog>
  )
}
