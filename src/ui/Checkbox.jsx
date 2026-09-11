// Галочка. ТЗ v4, разделы 6.2 и 17.

import styles from './Checkbox.module.css'

/**
 * @param {object} props
 * @param {string} props.label
 * @param {boolean} props.checked
 * @param {boolean} [props.disabled]
 * @param {(checked: boolean) => void} props.onChange
 */
export function Checkbox({ label, checked, disabled = false, onChange }) {
  return (
    <label className={styles.row}>
      <input
        className={styles.input}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.label}>{label}</span>
    </label>
  )
}
