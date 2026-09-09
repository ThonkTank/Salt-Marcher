import { useState } from 'react'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import type {
  SessionWorkspaceActions,
  SessionWorkspaceViewModel
} from '../session/session-workspace-model.js'
import '../session/session-groups-panel.css'

export function DesktopSceneFacts({
  model,
  actions,
  busy = false
}: {
  model: SessionWorkspaceViewModel
  actions: SessionWorkspaceActions
  busy?: boolean
}) {
  const [editingLocation, setEditingLocation] = useState(false)
  const focused = model.focused
  return (
    <>
      <div className="desktop-scene-facts">
        {editingLocation ? (
          <select
            disabled={busy}
            autoFocus
            aria-label={message('ui.scene.ort')}
            value={focused.locationId ?? ''}
            onBlur={() => setEditingLocation(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setEditingLocation(false)
            }}
            onChange={(event) => {
              if (busy) return
              actions.setSceneLocation(event.target.value || null)
              setEditingLocation(false)
            }}
          >
            <option value="">{message('ui.kein.ort')}</option>
            {model.control.locationUnavailable && (
              <option value={focused.locationId!}>
                {model.control.focusedLocationLabel}
              </option>
            )}
            {model.control.locationChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.displayName}
              </option>
            ))}
          </select>
        ) : (
          <button
            disabled={busy}
            onClick={() => {
              if (!busy) setEditingLocation(true)
            }}
          >
            {model.control.focusedLocationLabel}
          </button>
        )}
        <span>
          {formatMessage('desktop.time', {
            day: Math.floor(focused.gameTimeSeconds / 86400) + 1,
            hours: String(
              Math.floor(focused.gameTimeSeconds / 3600) % 24
            ).padStart(2, '0'),
            minutes: String(
              Math.floor(focused.gameTimeSeconds / 60) % 60
            ).padStart(2, '0')
          })}
        </span>
      </div>
    </>
  )
}
