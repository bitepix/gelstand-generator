import { useReducer } from 'react'

import { reducer } from './state/reducer.js'
import { makeInitialState } from './state/initial.js'
import { useGeneration } from './state/useGeneration.js'
import { Panel } from './screens/Panel.jsx'
import { Step3 } from './screens/Step3.jsx'
import styles from './App.module.css'

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState)
  useGeneration(state, dispatch)

  return (
    <main className={styles.app} data-step={state.step}>
      <header className={styles.header}>
        <h1 className={styles.title}>Nail Modernism Gelstand</h1>
        <p className={styles.subtitle}>Генератор подставок под баночки</p>
      </header>

      {state.step === 3 ? (
        <Step3 state={state} dispatch={dispatch} />
      ) : (
        <Panel state={state} dispatch={dispatch} />
      )}
    </main>
  )
}
