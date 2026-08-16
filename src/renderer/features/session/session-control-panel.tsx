import { useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SceneSnapshot } from '../../../shared/contracts/scene.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/session-runtime.de.js'
import { sessionCapabilities } from './session-capabilities.js'
import './session-control-panel.css'

type RunningScene = SceneSnapshot['scenes'][number]

export function SessionControlPanel(props: {
  snapshot: LiveSessionSnapshot
  focused: RunningScene
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
  manageGroups: () => void
}) {
  const api = useCapabilityApi()
  const [editing, setEditing] = useState<'scene' | 'location' | null>(null)
  const run = async (operation: () => Promise<LiveSessionSnapshot>) => {
    try {
      props.setSnapshot(await operation())
      setEditing(null)
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  const location = props.snapshot.scene.locationChoices.find(
    (candidate) => candidate.id === props.focused.locationId
  )
  const locationLabel = props.focused.locationId
    ? (location?.displayName ??
      props.focused.locationName ??
      message('ui.nicht.verfuegbarer.ort'))
    : message('ui.kein.ort')
  return (
    <section
      className="session-control-panel"
      aria-label={message('ui.session.steuerung')}
    >
      <div className="panel-heading">
        <h2>{message('ui.session.steuerung')}</h2>
        <button onClick={props.manageGroups}>
          {message('ui.gruppen.managen')}
        </button>
      </div>
      <div className="control-register">
        <div className="register-row active">
          <span className="register-label">{message('ui.szene')}</span>
          {editing === 'scene' ? (
            <span className="register-editor">
              <select
                autoFocus
                aria-label={message('ui.aktive.szene')}
                value={props.focused.id}
                onBlur={() => setEditing(null)}
                onChange={(event) => {
                  const sceneId = event.target.value
                  void run(() =>
                    sessionCapabilities(api).scene.focus(
                      sceneId,
                      props.snapshot.scene.revision
                    )
                  )
                }}
              >
                {props.snapshot.scene.scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.title}
                  </option>
                ))}
              </select>
            </span>
          ) : (
            <>
              <span className="register-value" title={props.focused.title}>
                {props.focused.title}
              </span>
              <button
                type="button"
                disabled={props.snapshot.scene.scenes.length < 2}
                onClick={() => setEditing('scene')}
              >
                {message('ui.wechseln')}
              </button>
            </>
          )}
        </div>
        <div className="register-row">
          <span className="register-label">{message('ui.ort')}</span>
          {editing === 'location' ? (
            <span className="register-editor">
              <select
                autoFocus
                aria-label={message('ui.scene.ort')}
                value={props.focused.locationId ?? ''}
                onBlur={() => setEditing(null)}
                onChange={(event) => {
                  const locationId = event.target.value || null
                  void run(() =>
                    sessionCapabilities(api).scene.setLocation(
                      props.focused.id,
                      locationId,
                      props.snapshot.scene.revision
                    )
                  )
                }}
              >
                <option value="">{message('ui.kein.ort')}</option>
                {props.focused.locationId && !location && (
                  <option value={props.focused.locationId}>
                    {message('ui.nicht.verfuegbarer.ort')}
                  </option>
                )}
                {props.snapshot.scene.locationChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.displayName}
                  </option>
                ))}
              </select>
            </span>
          ) : (
            <>
              <span
                className={`register-value${
                  props.focused.locationId ? '' : ' unset'
                }`}
                title={locationLabel}
              >
                {locationLabel}
              </span>
              <button type="button" onClick={() => setEditing('location')}>
                {message('ui.setzen')}
              </button>
            </>
          )}
        </div>
      </div>
      {props.snapshot.scene.scenes.length > 1 && (
        <p className="panel-hint">{message('session.independentHint')}</p>
      )}
    </section>
  )
}
