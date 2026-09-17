// Превью модели. ТЗ v3, раздел 11.
//
// Сцена three.js создаётся один раз на всё время жизни компонента, а при
// новой модели меняется только геометрия. Старая освобождается вручную:
// geometry.dispose() — иначе десять перегенераций подряд оставили бы в
// памяти десять сеток по 400 тысяч треугольников.
//
// Состояния: Loading, Ready, Error / Empty. Последнее — только когда готовой
// модели не было ни разу (11.1); при ошибке обновления предыдущая модель
// остаётся в обычном Ready (11.2).

import { useEffect, useRef } from 'react'
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { Loader } from '../ui/Loader.jsx'
import styles from './Preview.module.css'

const FOV = 40

/**
 * Самовращение превью. 2.0 у OrbitControls — это оборот за 30 секунд, так что
 * 1.0 даёт минуту: заметно, что деталь живая, но следить за ней не приходится.
 */
const SPIN = 1.0

/** Пауза после того, как мышь отпустили, прежде чем вращение вернётся. */
const SPIN_IDLE = 2500

/** Сцена, живущая между перерисовками React. */
function createScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new Scene()
  scene.background = new Color(0xf4f4f6)

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 5000)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true

  // Пока модель не трогают, она медленно поворачивается сама: со статичной
  // картинки не видно ни глубины полостей, ни фасок. Как только человек берёт
  // её мышью — вращение прекращается и возвращается через паузу.
  //
  // matchMedia читается на каждом возврате, а не один раз: так смена системной
  // настройки подхватывается без подписки.
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)')
  controls.autoRotateSpeed = SPIN
  let idle = 0

  const spin = () => {
    controls.autoRotate = !calm.matches
  }
  spin()

  controls.addEventListener('start', () => {
    controls.autoRotate = false
    clearTimeout(idle)
  })
  controls.addEventListener('end', () => {
    clearTimeout(idle)
    idle = setTimeout(spin, SPIN_IDLE)
  })

  scene.add(new AmbientLight(0xffffff, 1.8))
  const key = new DirectionalLight(0xffffff, 2.2)
  key.position.set(1, 1.4, 1)
  scene.add(key)

  const material = new MeshStandardMaterial({ color: 0xc9c9d1, roughness: 0.75, metalness: 0.05 })
  const mesh = new Mesh(new BufferGeometry(), material)
  scene.add(mesh)

  // Стол принтера под моделью. ТЗ 11 и блок H4: пространственное мышление —
  // не у всех, а увидеть, сколько места подставка занимает на столе, надо.
  const bedGroup = new Group()
  scene.add(bedGroup)
  const bedLine = new LineBasicMaterial({ color: 0x9a9aa4 })
  const fieldLine = new LineBasicMaterial({ color: 0xc4c4cc })
  // Подставка не влезла в полезное поле — обе рамки краснеют (ТЗ 7).
  const overLine = new LineBasicMaterial({ color: 0xb3261e })

  /** Прямоугольник в плоскости XY, центром в начале координат. */
  const rectangle = (x, y, lineMaterial) => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(
      [-x / 2, -y / 2, 0, x / 2, -y / 2, 0, x / 2, y / 2, 0, -x / 2, y / 2, 0], 3,
    ))
    return new LineLoop(geometry, lineMaterial)
  }

  let bed = null
  let bottom = 0

  function drawBed() {
    for (const child of bedGroup.children) child.geometry.dispose()
    bedGroup.clear()
    if (bed === null) return
    bedGroup.add(rectangle(bed.x, bed.y, bed.over ? overLine : bedLine))
    // Отступ показан отдельной линией: видно, почему полезное поле меньше стола.
    if (bed.field) {
      bedGroup.add(rectangle(bed.field.x, bed.field.y, bed.over ? overLine : fieldLine))
    }
    bedGroup.position.z = bottom
  }

  let frame = 0
  const loop = () => {
    frame = requestAnimationFrame(loop)
    controls.update()
    renderer.render(scene, camera)
  }
  loop()

  return {
    setModel({ positions, indices, bbox }) {
      const raw = new BufferGeometry()
      raw.setAttribute('position', new BufferAttribute(positions, 3))
      raw.setIndex(new BufferAttribute(indices, 1))

      // Нормали считаются с порогом по углу, а не усреднением по всем смежным
      // граням. Обычный computeVertexNormals сглаживает и острые рёбра —
      // верхушки стоек тогда выглядят скошенными, будто на них есть фаска,
      // хотя в геометрии её нет. Порог 40° оставляет скругления гладкими.
      const geometry = toCreasedNormals(raw, (40 * Math.PI) / 180)
      raw.dispose()

      // Модель лежит в положительном октанте — ставим её центром в начало
      // координат, чтобы орбита вращалась вокруг детали, а не мимо неё.
      geometry.translate(-bbox.x / 2, -bbox.y / 2, -bbox.z / 2)

      mesh.geometry.dispose()
      mesh.geometry = geometry

      bottom = -bbox.z / 2
      drawBed()

      // Дистанция по описанной сфере: и деталь, и стол целиком попадают в
      // кадр при любом соотношении сторон.
      const span = bed ? { x: Math.max(bbox.x, bed.x), y: Math.max(bbox.y, bed.y) } : bbox
      const radius = Math.hypot(span.x, span.y, bbox.z) / 2
      const distance = radius / Math.sin((FOV / 2) * (Math.PI / 180))
      camera.near = Math.max(distance / 100, 0.1)
      camera.far = distance * 10
      camera.position.set(distance * 0.6, -distance * 0.7, distance * 0.5)
      camera.up.set(0, 0, 1)
      controls.target.set(0, 0, 0)
      controls.update()
    },

    setBed(next) {
      bed = next
      drawBed()
    },

    resize(width, height) {
      if (width === 0 || height === 0) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },

    dispose() {
      cancelAnimationFrame(frame)
      clearTimeout(idle)
      controls.dispose()
      for (const child of bedGroup.children) child.geometry.dispose()
      mesh.geometry.dispose()
      material.dispose()
      bedLine.dispose()
      fieldLine.dispose()
      overLine.dispose()
      renderer.dispose()
    },
  }
}

/**
 * @param {object} props
 * @param {{ positions: Float32Array, indices: Uint32Array, bbox: object } | null} props.model
 * @param {'idle'|'pending'|'ready'|'error'} props.status
 * @param {string} [props.caption]  строка габарита и количества ячеек
 * @param {{ x: number, y: number, field?: { x: number, y: number }, over?: boolean } | null} [props.bed]
 */
export function Preview({ model, status, caption, bed = null }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return undefined
    const scene = createScene(canvasRef.current)
    sceneRef.current = scene

    const box = canvasRef.current.parentElement
    const observer = new ResizeObserver(([entry]) => {
      scene.resize(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(box)

    return () => {
      observer.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    if (model && sceneRef.current) sceneRef.current.setModel(model)
  }, [model])

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.setBed(bed)
  }, [bed])

  const empty = model === null

  return (
    <div className={styles.preview}>
      <div className={styles.stage} data-hidden={empty || undefined}>
        <canvas ref={canvasRef} className={styles.canvas} />

        {status === 'pending' && (
          <div className={styles.overlay}>
            <Loader size="lg" />
          </div>
        )}

        {empty && status !== 'pending' && (
          <p className={styles.placeholder}>
            {status === 'error' ? 'Модель не построена' : 'Здесь появится модель'}
          </p>
        )}

        {caption && <p className={styles.caption}>{caption}</p>}
      </div>
    </div>
  )
}
