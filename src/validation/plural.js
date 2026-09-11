// Склонение существительного при числе. Нужно ровно в одном месте — плашке
// о делении сетки, — но «4 подставок» читается как опечатка, а Intl.PluralRules
// отдаёт категорию, а не слово, так что выбирать форму всё равно вручную.

/**
 * @param {number} count
 * @param {[string, string, string]} forms  1 подставка, 2 подставки, 5 подставок
 */
export function plural(count, forms) {
  const n = Math.abs(count) % 100
  if (n > 10 && n < 20) return forms[2]
  const last = n % 10
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}
