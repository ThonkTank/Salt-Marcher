import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement
} from 'react'
import type { CampaignSnapshot } from '../../shared/contracts/campaign.js'
import { PixiQualificationView } from '../spatial-2d/pixi-qualification-view.js'
import { BabylonQualificationView } from '../spatial-3d/babylon-qualification-view.js'
import { qualificationViewport } from '../spatial-2d/sparse-pixi-qualification.js'
import {
  SpatialQualificationModel,
  type SpatialQualificationState
} from '../spatial-qualification-model.js'

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
  const spatialModel = useMemo(
    () => new SpatialQualificationModel(qualificationViewport()),
    []
  )
  const [spatialState, setSpatialState] = useState<SpatialQualificationState>(
    spatialModel.state
  )
  const readOnly = window.saltMarcher.runtime.readOnly
  const e2e = window.saltMarcher.runtime.e2e
  useEffect(() => {
    void window.saltMarcher.campaigns
      .list()
      .then(setSnapshot)
      .catch((cause: unknown) => setError(readError(cause)))
  }, [])
  useEffect(() => spatialModel.subscribe(setSpatialState), [spatialModel])
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
              <PixiQualificationView model={spatialModel} />
            </div>
            <div>
              <h3>3D dungeon</h3>
              <BabylonQualificationView model={spatialModel} />
            </div>
          </div>
          <SpatialTextAlternative model={spatialModel} state={spatialState} />
        </section>
      ) : null}
    </main>
  )
}

function SpatialTextAlternative({
  model,
  state
}: {
  readonly model: SpatialQualificationModel
  readonly state: SpatialQualificationState
}): ReactElement {
  return (
    <section aria-labelledby="spatial-text-alternative-heading">
      <h3 id="spatial-text-alternative-heading">
        Text alternative for the spatial qualification
      </h3>
      <p>
        This keyboard-operable alternative exposes the same fixture scale and
        spatial selection information without requiring WebGL.
      </p>
      <p>
        2D position:{' '}
        <output>{`${state.viewport.x}, ${state.viewport.y}`}</output>. The
        fixture contains 100,000 sparse cells and 8,192 initially visible facts.
      </p>
      <div className="inline-form" aria-label="Move the 2D text alternative">
        <button type="button" onClick={() => model.pan(-24, 0)}>
          Move west
        </button>
        <button type="button" onClick={() => model.pan(24, 0)}>
          Move east
        </button>
      </div>
      <p>
        3D selection:{' '}
        <output>{state.selectedChunk ?? 'no chunk selected'}</output>. The
        dungeon fixture includes a remeshable 32 × 32 × 16 voxel chunk and 25
        pickable surrounding chunks.
      </p>
      <div className="inline-form" aria-label="Select a dungeon chunk">
        <button type="button" onClick={() => model.select('chunk--2--2')}>
          Select northwest chunk
        </button>
        <button type="button" onClick={() => model.select('chunk-2-2')}>
          Select southeast chunk
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        Text alternative updated: {state.viewport.x}, {state.viewport.y};{' '}
        {state.selectedChunk ?? 'no chunk selected'}.
      </p>
    </section>
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
