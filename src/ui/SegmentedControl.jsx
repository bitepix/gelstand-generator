// Переключатель формы ячейки. ТЗ v3, разделы 1.1, 17 и 17.2.
//
// В альфе активна только прямоугольная форма. Пункт «Круглая» отрисован
// неактивным и помечен бэйджем Soon: он намеренно не button, поэтому не
// получает фокус с клавиатуры и не реагирует на клик.

import styles from './SegmentedControl.module.css'

/** @param {{ shape: string, disabled?: boolean, onChange: (shape: string) => void }} props */
export function SegmentedControl({ shape, disabled = false, onChange }) {
  return (
    <div className={styles.group} role="group" aria-label="Форма ячейки">
      <button
        type="button"
        className={styles.option}
        data-selected={shape === 'rect' || undefined}
        disabled={disabled}
        onClick={() => onChange('rect')}
      >
        Прямоугольная
      </button>

      <span className={styles.option} data-soon="" aria-disabled="true">
        Круглая
        <span className={styles.badge}>Soon</span>
      </span>
    </div>
  )
}
