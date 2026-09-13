// Переключатель формы ячейки. ТЗ v3, разделы 1.1, 17 и 17.2.

import styles from './SegmentedControl.module.css'

const OPTIONS = [
  { shape: 'rect', label: 'Прямоугольная' },
  { shape: 'round', label: 'Круглая' },
]

/** @param {{ shape: string, disabled?: boolean, onChange: (shape: string) => void }} props */
export function SegmentedControl({ shape, disabled = false, onChange }) {
  return (
    <div className={styles.group} role="group" aria-label="Форма ячейки">
      {OPTIONS.map((option) => (
        <button
          key={option.shape}
          type="button"
          className={styles.option}
          data-selected={shape === option.shape || undefined}
          disabled={disabled}
          onClick={() => onChange(option.shape)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
