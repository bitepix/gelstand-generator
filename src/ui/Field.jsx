// Поле ввода. ТЗ v3, разделы 17 и 17.1.
//
// План называл два компонента, Dimension Input и Quantity Input. Отличаются
// они только видом поля — минимумом, клавиатурой на мобильном и тем, целое
// значение или дробное, — а это уже знает fieldKind по имени поля. Поэтому
// компонент один: две обёртки с одинаковым телом ничего бы не добавили.
//
// type="text" с inputMode, а не type="number": числовое поле в связке с
// запятой ведёт себя по-разному в разных браузерах и локалях.

import { fieldKind, normalize } from '../validation/normalize.js'
import styles from './Field.module.css'

/**
 * @param {object} props
 * @param {'width'|'depth'|'nx'|'ny'} props.field
 * @param {string} props.label
 * @param {string} props.value    строка как есть, без нормализации
 * @param {boolean} [props.error]
 * @param {boolean} [props.disabled]
 * @param {string} [props.describedBy]  id блока ошибок
 * @param {(field: string, value: string) => void} props.onChange
 * @param {(field: string, value: string) => void} props.onCommit  уже нормализованное
 */
export function Field({
  field,
  label,
  value,
  error = false,
  disabled = false,
  describedBy,
  onChange,
  onCommit,
}) {
  const kind = fieldKind(field)

  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        type="text"
        inputMode={kind === 'count' ? 'numeric' : 'decimal'}
        value={value}
        disabled={disabled}
        aria-invalid={error || undefined}
        aria-describedby={error ? describedBy : undefined}
        data-error={error || undefined}
        onChange={(event) => onChange(field, event.target.value)}
        // Нормализация по завершении ввода, а не по каждому нажатию: иначе
        // «19,» превратилось бы в «19» прямо под пальцами (ТЗ 5.1).
        onBlur={(event) => onCommit(field, normalize(event.target.value, kind))}
      />
    </label>
  )
}
