// Индикатор ожидания. ТЗ v3, раздел 17.
//
// Два размера: в кнопке и в превью. При prefers-reduced-motion вращение
// отключается — остаётся статичное кольцо, см. Loader.module.css.

import styles from './Loader.module.css'

/** @param {{ size?: 'sm' | 'lg', label?: string }} props */
export function Loader({ size = 'sm', label = 'Идёт генерация' }) {
  return <span className={styles.loader} data-size={size} role="status" aria-label={label} />
}
