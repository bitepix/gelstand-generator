// Выпадающий список. ТЗ v4, разделы 6.1 и 17.
//
// Нативный <select>: на мобильном он открывается системным колесом, а это
// лучше любой своей реализации. Оформление ограничено рамкой и стрелкой.

import styles from './Select.module.css'

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.placeholder  пункт, когда ничего не выбрано
 * @param {string|null} props.value
 * @param {{ value: string, label: string }[]} props.options
 * @param {boolean} [props.disabled]
 * @param {(value: string) => void} props.onChange
 */
export function Select({ label, placeholder, value, options, disabled = false, onChange }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.wrap}>
        <select
          className={styles.select}
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
    </label>
  )
}
