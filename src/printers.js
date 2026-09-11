// Линейка принтеров. ТЗ v4, разделы 6.1 и 7.
//
// Отдельный модуль: линейка меняется, а всё остальное — нет. Высота стола не
// нужна, подставка 15 мм.
//
// P1P, X1C и X1E сняты с производства, но остаются в списке: они стоят у
// людей. Сверено по первоисточникам 2026-09-11.

/**
 * Отступ от края стола, мм, с каждой стороны. Печатать в размер пластины —
 * плохая идея: за края берутся пальцами, у самой кромки деталь хуже липнет,
 * а слайсер выкладывает в начале печати ознакомительную линию.
 */
export const EDGE_MARGIN = 30

/** Алфавитный порядок — как в интерфейсе. */
export const PRINTERS = [
  { id: 'a1', name: 'Bambu Lab A1', bed: { x: 256, y: 256 } },
  { id: 'a1-mini', name: 'Bambu Lab A1 mini', bed: { x: 180, y: 180 } },
  { id: 'a2l', name: 'Bambu Lab A2L', bed: { x: 330, y: 320 } },
  { id: 'h2c', name: 'Bambu Lab H2C', bed: { x: 305, y: 320 } },
  { id: 'h2d', name: 'Bambu Lab H2D', bed: { x: 350, y: 320 } },
  { id: 'h2d-pro', name: 'Bambu Lab H2D Pro', bed: { x: 350, y: 320 } },
  { id: 'h2s', name: 'Bambu Lab H2S', bed: { x: 340, y: 320 } },
  { id: 'p1p', name: 'Bambu Lab P1P', bed: { x: 256, y: 256 } },
  { id: 'p1s', name: 'Bambu Lab P1S', bed: { x: 256, y: 256 } },
  { id: 'p2s', name: 'Bambu Lab P2S', bed: { x: 256, y: 256 } },
  { id: 'x1c', name: 'Bambu Lab X1C', bed: { x: 256, y: 256 } },
  { id: 'x1e', name: 'Bambu Lab X1E', bed: { x: 256, y: 256 } },
  { id: 'x2d', name: 'Bambu Lab X2D', bed: { x: 256, y: 256 } },
]

/** Подпись пункта списка: название и область печати через тире. */
export const printerLabel = (printer) =>
  `${printer.name} — ${printer.bed.x} × ${printer.bed.y} мм`

export const findPrinter = (id) => PRINTERS.find((p) => p.id === id) ?? null

/** Наибольшая область в линейке: предел, когда принтера нет. */
const LARGEST = PRINTERS.reduce(
  (max, p) => ({ x: Math.max(max.x, p.bed.x), y: Math.max(max.y, p.bed.y) }),
  { x: 0, y: 0 },
)

/**
 * Полезное поле печати, мм. ТЗ 7.
 *
 * Принтер выбран — область минус отступ с каждой стороны. Не выбран или стоит
 * галочка «нет принтера» — наибольшая область в линейке и без вычета:
 * печатать будет кто-то другой, на неизвестном столе и по своим правилам.
 *
 * @param {{ printer: string|null, noPrinter: boolean }} state
 */
export function printField({ printer, noPrinter }) {
  const model = noPrinter ? null : findPrinter(printer)
  if (model === null) return { ...LARGEST }
  return { x: model.bed.x - 2 * EDGE_MARGIN, y: model.bed.y - 2 * EDGE_MARGIN }
}
