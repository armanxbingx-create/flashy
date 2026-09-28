import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { seedDatabase } from './data'

let splashHidden = false

function hideSplash() {
  if (splashHidden) return
  const splash = document.getElementById('splash')
  if (!splash) return
  splashHidden = true

  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduced) {
    splash.remove()
    return
  }
  splash.classList.add('is-hiding')
  window.setTimeout(() => splash.remove(), 260)
}

async function bootstrap() {
  try {
    await seedDatabase()
  } catch (error) {
    console.error('Flashy: initialisation failed', error)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  // Drop the static splash once React has painted its first frame.
  requestAnimationFrame(() => requestAnimationFrame(hideSplash))
  window.setTimeout(hideSplash, 1600)
}

bootstrap()
