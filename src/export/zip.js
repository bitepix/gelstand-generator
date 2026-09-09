// Минимальный zip-писатель без сжатия. ТЗ v3, раздел 13.
//
// 3MF — это zip из трёх XML. Сжатие ему не требуется, а метод «store»
// убирает единственную причину тянуть библиотеку: файл собирается из
// заголовков фиксированной длины и содержимого как есть.

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50

/** Дата 1980-01-01 в формате MS-DOS: время нулевое, дата — минимально допустимая. */
const DOS_DATE = 0x21

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

/**
 * Собирает zip без сжатия.
 *
 * @param {{ name: string, data: Uint8Array }[]} entries
 * @returns {Uint8Array[]} куски в порядке следования — годятся прямо в Blob
 */
export function zipStore(entries) {
  const encoder = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBytes = encoder.encode(name)
    const crc = crc32(data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, LOCAL_SIG, true)
    local.setUint16(4, 20, true) // минимальная версия
    local.setUint16(6, 0, true) // флаги
    local.setUint16(8, 0, true) // метод 0 — без сжатия
    local.setUint16(10, 0, true) // время
    local.setUint16(12, DOS_DATE, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true) // сжатый размер
    local.setUint32(22, data.length, true) // исходный размер
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true) // extra

    parts.push(new Uint8Array(local.buffer), nameBytes, data)

    const entry = new DataView(new ArrayBuffer(46))
    entry.setUint32(0, CENTRAL_SIG, true)
    entry.setUint16(4, 20, true) // версия создателя
    entry.setUint16(6, 20, true) // минимальная версия
    entry.setUint16(8, 0, true)
    entry.setUint16(10, 0, true)
    entry.setUint16(12, 0, true)
    entry.setUint16(14, DOS_DATE, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, data.length, true)
    entry.setUint32(24, data.length, true)
    entry.setUint16(28, nameBytes.length, true)
    entry.setUint16(30, 0, true) // extra
    entry.setUint16(32, 0, true) // комментарий
    entry.setUint16(34, 0, true) // номер диска
    entry.setUint16(36, 0, true) // внутренние атрибуты
    entry.setUint32(38, 0, true) // внешние атрибуты
    entry.setUint32(42, offset, true) // смещение локального заголовка

    central.push(new Uint8Array(entry.buffer), nameBytes)
    offset += 30 + nameBytes.length + data.length
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0)

  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, EOCD_SIG, true)
  eocd.setUint16(4, 0, true) // номер диска
  eocd.setUint16(6, 0, true) // диск с оглавлением
  eocd.setUint16(8, entries.length, true)
  eocd.setUint16(10, entries.length, true)
  eocd.setUint32(12, centralSize, true)
  eocd.setUint32(16, offset, true)
  eocd.setUint16(20, 0, true) // комментарий

  return [...parts, ...central, new Uint8Array(eocd.buffer)]
}
