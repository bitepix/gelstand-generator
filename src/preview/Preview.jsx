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
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { Loader } from '../ui/Loader.jsx'
import styles from './Preview.module.css'

const FOV = 40

/** Сцена, живущая между перерисовками React. */
function createScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new Scene()
  scene.background = new Color(0xf4f4f6)

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 5000)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true

  scene.add(new AmbientLight(0xffffff, 1.8))
  const key = new DirectionalLight(0xffffff, 2.2)
  key.position.set(1, 1.4, 1)
  scene.add(key)

  const material = new MeshStandardMaterial({ color: 0xc9c9d1, roughness: 0.75, metalness: 0.05 })
  const mesh = new Mesh(new BufferGeometry(), material)
  scene.add(mesh)

  let frame = 0
  const loop = () => {
    frame = requestAnimationFrame(loop)
    controls.update()
    renderer.render(scene, camera)
  }
  loop()

  return {
    setModel({ positions, indices, bbox }) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(positions, 3))
      geometry.setIndex(new BufferAttribute(indices, 1))
      geometry.computeVertexNormals()
      // Модель лежит в положительном октанте — ставим её центром в начало
      // координат, чтобы орбита вращалась вокруг детали, а не мимо неё.
      geometry.translate(-bbox.x / 2, -bbox.y / 2, -bbox.z / 2)

      mesh.geometry.dispose()
      mesh.geometry = geometry

      // Дистанция по описанной сфере: деталь целиком попадает в кадр при
      // любом соотношении сторон.
      const radius = Math.hypot(bbox.x, bbox.y, bbox.z) / 2
      const distance = radius / Math.sin((FOV / 2) * (Math.PI / 180))
      camera.near = Math.max(distance / 100, 0.1)
      camera.far = distance * 10
      camera.position.set(distance * 0.6, -distance * 0.7, distance * 0.5)
      camera.up.set(0, 0, 1)
      controls.target.set(0, 0, 0)
      controls.update()
    },

    resize(width, height) {
      if (width === 0 || height === 0) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },

    dispose() {
      cancelAnimationFrame(frame)
      controls.dispose()
      mesh.geometry.dispose()
      material.dispose()
      renderer.dispose()
    },
  }
}

/**
 * @param {object} props
 * @param {{ positions: Float32Array, indices: Uint32Array, bbox: object } | null} props.model
 * @param {'idle'|'pending'|'ready'|'error'} props.status
 * @param {string} [props.caption]  строка габарита и количества ячеек
 */
export function Preview({ model, status, caption }) {
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
      </div>

      {caption && <p className={styles.caption}>{caption}</p>}
    </div>
  )
}
