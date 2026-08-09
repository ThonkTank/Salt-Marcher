import type { GeneratorPresetEditorSnapshot } from '../../../shared/contracts/generator-presets.js'
import { message } from '../../i18n/generator-runtime.de.js'

export function GeneratorPresetToolbar(props: {
  snapshot: GeneratorPresetEditorSnapshot
  presetId: string | null
  presetName: string
  busy: boolean
  dirty: boolean
  activeCampaignId: string | null
  select: (id: string) => void
  rename: (name: string) => void
  save: () => void
  assign: () => void
  remove: () => void
}) {
  const selected = props.snapshot.registry.presets.find(
    (preset) => preset.id === props.presetId
  )
  const effectivePresetId = props.snapshot.assignment?.effectivePresetId ?? null
  const actions = [
    {
      label: selected?.protected ? message('g.saveCopy') : message('g.save'),
      disabled:
        props.busy || !props.dirty || props.presetName.trim().length === 0,
      run: props.save
    },
    {
      label: message('g.assign'),
      disabled: props.busy || !props.activeCampaignId || props.dirty,
      run: props.assign
    },
    {
      label: message('g.delete'),
      disabled: props.busy || selected?.protected !== false,
      run: props.remove
    }
  ]

  return (
    <header className="generator-settings-heading">
      <div>
        <p className="section-kicker">{message('g.rules')}</p>
        <h3 id="generator-title">{message('g.title')}</h3>
      </div>
      <div className="preset-toolbar">
        <label>
          <span>{message('g.preset')}</span>
          <select
            value={props.presetId ?? ''}
            disabled={props.busy}
            onChange={(event) => props.select(event.target.value)}
          >
            {props.snapshot.registry.presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
                {preset.protected ? ' (System)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{message('g.name')}</span>
          <input
            value={props.presetName}
            maxLength={100}
            disabled={props.busy}
            onChange={(event) => props.rename(event.target.value)}
          />
        </label>
        {actions.map((action) => (
          <button
            type="button"
            key={action.label}
            disabled={action.disabled}
            onClick={action.run}
          >
            {action.label}
          </button>
        ))}
        {selected && (
          <p className="preset-status">
            {message(
              selected.protected
                ? 'g.preset.systemStatus'
                : 'g.preset.customStatus'
            )}
            {' · '}
            {message(
              selected.id === effectivePresetId
                ? 'g.preset.assignedStatus'
                : 'g.preset.unassignedStatus'
            )}
          </p>
        )}
      </div>
    </header>
  )
}
