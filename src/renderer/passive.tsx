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
      <p className="eyebrow">SaltMarcher</p>
      <h1>Passive Anzeige</h1>
      {projection?.campaignId === null ? (
        <p>
          Eine party-sichere Projektion wurde noch nicht ausgewählt. Bis dahin
          bleiben Kampagnen- und GM-Daten verborgen.
        </p>
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
          ? 'Keine Datenfreigabe aktiv'
          : 'Freigegebene Projektion'}{' '}
        · Core {coreStatus}
      </p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PassiveDisplay />
  </StrictMode>
)
