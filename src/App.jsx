import { useReducer } from 'react'
import { reducer } from './state/reducer.js'
import { makeInitialState } from './state/initial.js'
import { snapshot } from './state/snapshot.js'

// Каркас. Интерфейса пока нет — экран показывает дерево состояния,
// чтобы было видно, что редьюсер живой. Компоненты приходят в блоке C.
export default function App() {
  const [state] = useReducer(reducer, undefined, makeInitialState)

  return (
    <main style={{ font: '14px/1.5 system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 18 }}>Nail Modernism Gelstand</h1>
      <p>Каркас. Шаг {state.step} из 3.</p>
      <pre>{JSON.stringify(state, null, 2)}</pre>
      <p>snapshot: {snapshot(state)}</p>
    </main>
  )
}
