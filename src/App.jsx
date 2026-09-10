import { useReducer } from 'react'

import { reducer } from './state/reducer.js'
import { makeInitialState } from './state/initial.js'
import { Panel } from './screens/Panel.jsx'
import styles from './App.module.css'

// Третий шаг пока рисуется той же панелью: превью приходит в D2, логика
// кнопок и генерация — в D3.
export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState)

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Nail Modernism Gelstand</h1>
        <p className={styles.subtitle}>Генератор подставок под баночки</p>
      </header>

      <Panel state={state} dispatch={dispatch} />
    </main>
  )
}
