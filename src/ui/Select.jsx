// Выпадающий список. ТЗ v4, разделы 6.1 и 17.
//
// Нативный <select>: на мобильном он открывается системным колесом, а это
// лучше любой своей реализации. Оформление ограничено рамкой и стрелкой.
//
// Видимой подписи нет — её даёт заголовок раздела «Принтер», — но имя
// контролу всё равно нужно, поэтому подпись уходит в aria-label.

import styles from './Select.module.css'

/**
 * @param {object} props
 * @param {string} props.label        уходит в aria-label: подпись даёт раздел
 * @param {string} props.placeholder  пункт, когда ничего не выбрано
 * @param {string|null} props.value
 * @param {{ value: string, label: string }[]} props.options
 * @param {boolean} [props.disabled]
 * @param {(value: string) => void} props.onChange
 */
export function Select({ label, placeholder, value, options, disabled = false, onChange }) {
  return (
    <span className={styles.wrap}>
      <select
        className={styles.select}
        aria-label={label}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  )
}
