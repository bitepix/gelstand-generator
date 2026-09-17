// Блок ошибок. ТЗ v3, раздел 16.
//
// Принимает массив кодов и показывает столько причин, сколько пришло: при
// Причин может быть несколько сразу: пустые Nx и Ny дают ERR-03 и ERR-04
// в одном блоке.
//
// Текст ошибки не выводится внутри поля никогда: поле лишь уходит в Error и
// ссылается сюда через aria-describedby.
//
// Отдельной кнопки «Повторить» в блоке нет: при технической ошибке в неё
// превращается основная кнопка (ТЗ 10), а две одинаковые кнопки рядом —
// лишний выбор. Если макет покажет иначе, добавить сюда.

import { messagesFor } from '../validation/messages.js'
import styles from './ErrorBlock.module.css'

/** @param {{ id: string, codes: string[] }} props */
export function ErrorBlock({ id, codes }) {
  const texts = messagesFor(codes)
  if (texts.length === 0) return null

  return (
    <div id={id} className={styles.block} role="alert">
      {texts.length === 1 ? (
        <p className={styles.text}>{texts[0]}</p>
      ) : (
        <ul className={styles.list}>
          {texts.map((text) => (
            <li key={text} className={styles.text}>
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
