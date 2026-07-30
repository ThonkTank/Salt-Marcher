import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import type { CampaignSnapshot } from '../../shared/contracts/campaign.js'
import { PixiQualificationView } from '../spatial-2d/pixi-qualification-view.js'
import { BabylonQualificationView } from '../spatial-3d/babylon-qualification-view.js'

declare global {
  interface Window {
    saltMarcher: import('../../shared/contracts/capability-api.js').SaltMarcherApi
  }
}
const emptySnapshot: CampaignSnapshot = {
  activeCampaignId: null,
  campaigns: []
}

export function App(): ReactElement {
  const [snapshot, setSnapshot] = useState<CampaignSnapshot>(emptySnapshot)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const readOnly = window.saltMarcher.runtime.readOnly
  const e2e = window.saltMarcher.runtime.e2e
  useEffect(() => {
    void window.saltMarcher.campaigns
      .list()
      .then(setSnapshot)
      .catch((cause: unknown) => setError(readError(cause)))
  }, [])
  async function createCampaign(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault()
    try {
      if (!hasCampaignWriteCapability(window.saltMarcher.campaigns)) return
      setSnapshot(await window.saltMarcher.campaigns.create(name))
      setName('')
      setError(null)
    } catch (cause) {
      setError(readError(cause))
    }
  }
  async function activateCampaign(id: string): Promise<void> {
    try {
      if (!hasCampaignWriteCapability(window.saltMarcher.campaigns)) return
      setSnapshot(await window.saltMarcher.campaigns.activate(id))
      setError(null)
    } catch (cause) {
      setError(readError(cause))
    }
  }
  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">SaltMarcher · Electron foundation</p>
        <h1>{readOnly ? 'Campaign display' : 'Campaigns'}</h1>
        <p>
          {readOnly
            ? 'This secondary window cannot write campaign data.'
            : 'Create, switch, and resume campaigns locally.'}
        </p>
      </header>
      {error !== null ? <p role="alert">{error}</p> : null}
      {!readOnly ? (
        <form onSubmit={(event) => void createCampaign(event)}>
          <label htmlFor="campaign-name">Campaign name</label>
          <div className="inline-form">
            <input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
            <button type="submit">Create campaign</button>
          </div>
        </form>
      ) : null}
      <section aria-labelledby="campaign-list-heading">
        <h2 id="campaign-list-heading">Available campaigns</h2>
        {snapshot.campaigns.length === 0 ? (
          <p>No campaign exists yet.</p>
        ) : (
          <ul>
            {snapshot.campaigns.map((campaign) => {
              const active = campaign.id === snapshot.activeCampaignId
              return (
                <li key={campaign.id}>
                  {readOnly ? (
                    <span aria-current={active ? 'true' : undefined}>
                      {campaign.name}
                      {active ? ' (active)' : ''}
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => void activateCampaign(campaign.id)}
                    >
                      {campaign.name}
                      {active ? ' (active)' : ''}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {!readOnly && !e2e ? (
        <section aria-labelledby="rendering-qualification-heading">
          <h2 id="rendering-qualification-heading">Rendering qualification</h2>
          <p>
            PixiJS renders 100,000 sparse cells (8,192 facts); Babylon.js
            renders pickable dungeon chunks with a local preview path.
          </p>
          <div className="qualification-grid">
            <div>
              <h3>2D sparse map</h3>
              <PixiQualificationView />
            </div>
            <div>
              <h3>3D dungeon</h3>
              <BabylonQualificationView />
            </div>
          </div>
          <details>
            <summary>Text alternative for the spatial qualification</summary>
            <p>
              The 2D fixture contains 100,000 sparse cells, including 8,192
              initially visible facts. Arrow keys dynamically recull the 2D
              view. The 3D fixture contains 25 pickable dungeon chunks; drag to
              orbit, click a chunk to select it, and press P to rebuild its
              local preview. Both views announce graphics-context recovery.
            </p>
          </details>
        </section>
      ) : null}
    </main>
  )
}
function readError(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : 'The requested operation could not be completed.'
}

function hasCampaignWriteCapability(
  campaigns:
    | import('../../shared/contracts/capability-api.js').CampaignReadCapability
    | import('../../shared/contracts/capability-api.js').CampaignCapability
): campaigns is import('../../shared/contracts/capability-api.js').CampaignCapability {
  return 'create' in campaigns && 'activate' in campaigns
}
