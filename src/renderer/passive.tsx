import { message } from './i18n/messages.de.js'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { CoreProcessStatus } from '../shared/contracts/runtime.js'
import './passive/passive.css'

declare global {
  interface Window {
    saltMarcherPassive: import('../shared/contracts/passive-display.js').PassiveDisplayApi
  }
}

export function PassiveDisplay() {
  const [projection, setProjection] = useState<
    import('../shared/contracts/passive-display.js').PassiveProjection | null
  >(null)
  const [coreStatus, setCoreStatus] = useState<CoreProcessStatus>('starting')
  useEffect(() => {
    let active = true
    const readProjection = async () => {
      try {
        const next = await window.saltMarcherPassive.readProjection()
        if (active) setProjection(next)
      } catch {
        // A status notification retries the read once the utility process is ready.
      }
    }
    const applyCoreStatus = (status: CoreProcessStatus) => {
      if (!active) return
      setCoreStatus(status)
      if (status === 'ready') void readProjection()
    }
    const stopProjection =
      window.saltMarcherPassive.onProjectionChanged(setProjection)
    const stopStatus = window.saltMarcherPassive.onCoreStatus(applyCoreStatus)
    void window.saltMarcherPassive.coreStatus().then(applyCoreStatus)
    return () => {
      active = false
      stopProjection()
      stopStatus()
    }
  }, [])
  return (
    <main>
      <p className="eyebrow">{message('ui.saltmarcher')}</p>
      <h1>{message('passive.heading')}</h1>
      {projection?.campaignId === null ? (
        <p>{message('passive.intro')}</p>
      ) : (
        <section>
          <h2>{projection?.title}</h2>
          <ul>
            {projection?.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
      )}
      <p className="status">
        {projection?.campaignId === null
          ? message('passive.empty')
          : message('passive.shared')}{' '}
        {message('ui.core')} {coreStatus}
      </p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PassiveDisplay />
  </StrictMode>
)
