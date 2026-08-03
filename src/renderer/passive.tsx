import { message } from './i18n/messages.de.js'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
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
  const [coreStatus, setCoreStatus] = useState('starting')
  useEffect(() => {
    void window.saltMarcherPassive.readProjection().then(setProjection)
    void window.saltMarcherPassive.coreStatus().then(setCoreStatus)
    const stopProjection =
      window.saltMarcherPassive.onProjectionChanged(setProjection)
    const stopStatus = window.saltMarcherPassive.onCoreStatus(setCoreStatus)
    return () => {
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
