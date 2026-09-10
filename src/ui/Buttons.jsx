// Кнопки. ТЗ v3, разделы 10 и 17.
//
// Тексты основной кнопки — «Продолжить», «Скачать», «Обновить», «Повторить» —
// приходят пропсом: какое из состояний раздела 10 сейчас, решает не кнопка.

import { Loader } from './Loader.jsx'
import styles from './Buttons.module.css'

/** @param {{ children: string, loading?: boolean, disabled?: boolean, onClick: () => void }} props */
export function PrimaryButton({ children, loading = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      className={styles.primary}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {loading && <Loader />}
      {children}
    </button>
  )
}

/** Доступна на третьем шаге всегда, включая время генерации. ТЗ 15.1. */
export function ResetButton({ children = 'Сбросить', onClick }) {
  return (
    <button type="button" className={styles.reset} onClick={onClick}>
      {children}
    </button>
  )
}
