import type {
  WorldNpc,
  WorldNpcDetailProjection
} from '../../../shared/contracts/world-npc.js'
import { message } from '../../i18n/catalog-runtime.de.js'

export function NpcCatalogInspector(props: {
  projection: WorldNpcDetailProjection | null
  edit: (npc: WorldNpc) => void
}) {
  const projection = props.projection
  return (
    <aside className="npc-inspector" aria-label={message('npc.inspector')}>
      {projection ? (
        <>
          <header>
            <div>
              <span>{message('npc.inspector')}</span>
              <h2>{projection.npc.displayName}</h2>
            </div>
            <button onClick={() => props.edit(projection.npc)}>
              {message('ui.bearbeiten')}
            </button>
          </header>
          <dl>
            <NpcFact
              label={message('npc.statblock')}
              value={projection.creatureDisplayName}
            />
            <NpcFact
              label={message('ui.status')}
              value={
                projection.npc.lifecycle === 'active'
                  ? message('npc.active')
                  : message('npc.defeated')
              }
            />
            <NpcFact
              label={message('npc.faction')}
              value={projection.factionDisplayName ?? '—'}
            />
            <NpcFact
              label={message('npc.location')}
              value={projection.locationDisplayName ?? '—'}
            />
            <NpcFact
              label={message('npc.dispositionModifier')}
              value={String(projection.npc.dispositionModifier)}
            />
          </dl>
          <NpcProse
            label={message('npc.appearance')}
            value={projection.npc.appearance}
          />
          <NpcProse
            label={message('npc.behavior')}
            value={projection.npc.behavior}
          />
          <NpcProse
            label={message('npc.history')}
            value={projection.npc.history}
          />
          <NpcProse
            label={message('ui.notizen')}
            value={projection.npc.notes}
          />
        </>
      ) : (
        <p>{message('npc.selectForInspector')}</p>
      )}
    </aside>
  )
}

function NpcFact(props: { label: string; value: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  )
}

function NpcProse(props: { label: string; value: string }) {
  if (!props.value) return null
  return (
    <section>
      <h3>{props.label}</h3>
      <p>{props.value}</p>
    </section>
  )
}
