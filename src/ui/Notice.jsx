// Информационная плашка. ТЗ v4, разделы 16 и 17.
//
// Не ошибка: ни поля не подсвечивает, ни переход не блокирует. Отсюда и
// отдельный компонент — Error Block значит другое.

import styles from './Notice.module.css'

/**
 * @param {object} props
 * @param {'offer'|'info'} [props.kind]  offer — жёлтая, info — нейтральная
 * @param {React.ReactNode} props.children
 */
export function Notice({ kind = 'info', children }) {
  return (
    <p className={styles.notice} data-kind={kind}>
      {children}
    </p>
  )
}
