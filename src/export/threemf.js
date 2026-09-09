// 3MF. ТЗ v3, раздел 13: основной формат, потому что хранит единицы
// измерения и слайсеру не приходится угадывать масштаб.
//
// Пакет — zip из трёх частей: типы содержимого, связи и сама модель.

import { zipStore } from './zip.js'

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel0" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`

/**
 * @param {{ positions: Float32Array, indices: Uint32Array }} mesh
 * @returns {Blob}
 */
export function export3MF(mesh) {
  const encoder = new TextEncoder()
  const parts = [
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: encoder.encode(RELS) },
    { name: '3D/3dmodel.model', data: encoder.encode(modelXML(mesh)) },
  ]
  return new Blob(zipStore(parts), { type: 'model/3mf' })
}

/** Число в атрибут: без экспоненты и без хвоста двоичной погрешности float32. */
function num(v) {
  return String(Number(v.toFixed(5)))
}

export function modelXML({ positions, indices }) {
  const vertices = []
  for (let i = 0; i < positions.length; i += 3) {
    vertices.push(
      `   <vertex x="${num(positions[i])}" y="${num(positions[i + 1])}" z="${num(positions[i + 2])}"/>`,
    )
  }

  const triangles = []
  for (let i = 0; i < indices.length; i += 3) {
    triangles.push(
      `   <triangle v1="${indices[i]}" v2="${indices[i + 1]}" v3="${indices[i + 2]}"/>`,
    )
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>
  <object id="1" type="model">
   <mesh>
    <vertices>
${vertices.join('\n')}
    </vertices>
    <triangles>
${triangles.join('\n')}
    </triangles>
   </mesh>
  </object>
 </resources>
 <build>
  <item objectid="1"/>
 </build>
</model>
`
}
