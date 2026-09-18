// Поле ввода. ТЗ v5, разделы 17 и 17.1.
//
// Видимой подписи у поля нет: её заменяет заголовок раздела («Введите размеры
// баночки», «Сетка»). Но имя полю всё равно нужно — без него ни скринридер,
// ни автозаполнение не поймут, что это за число, поэтому подпись уходит в
// aria-label.
//
// type="text" с inputMode, а не type="number": числовое поле в связке с
// запятой ведёт себя по-разному в разных браузерах и локалях.

import { fieldKind, normalize } from '../validation/normalize.js'
import styles from './Field.module.css'

/**
 * @param {object} props
 * @param {'width'|'depth'|'diameter'|'nx'|'ny'} props.field
 * @param {string} props.label           уходит в aria-label
 * @param {string} props.value           строка как есть, без нормализации
 * @param {string} [props.suffix]        единица внутри поля, справа
 * @param {boolean} [props.error]
 * @param {boolean} [props.disabled]
 * @param {string} [props.describedBy]   id блока ошибок
 * @param {(field: string, value: string) => void} props.onChange
 * @param {(field: string, value: string) => void} props.onCommit  уже нормализованное
 */
export function Field({
  field,
  label,
  value,
  suffix,
  error = false,
  disabled = false,
  describedBy,
  onChange,
  onCommit,
}) {
  const kind = fieldKind(field)

  return (
    <div className={styles.field} data-suffix={suffix ? '' : undefined}>
      <input
        className={styles.input}
        type="text"
        inputMode={kind === 'count' ? 'numeric' : 'decimal'}
        aria-label={label}
        value={value}
        disabled={disabled}
        aria-invalid={error || undefined}
        aria-describedby={error ? describedBy : undefined}
        data-error={error || undefined}
        onChange={(event) => onChange(field, event.target.value)}
        // Нормализация по завершении ввода, а не по каждому нажатию: иначе
        // «19,» превратилось бы в «19» прямо под пальцами (ТЗ 5.1).
        onBlur={(event) => onCommit(field, normalize(event.target.value, kind))}
        // Enter завершает ввод не хуже ухода из поля: ждать, пока человек
        // ткнёт мимо, чтобы модель пересчиталась, — так себе живое превью.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </div>
  )
}
