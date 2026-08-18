import { useState } from 'react'
import { message } from '../../i18n/session-runtime.de.js'
import type {
  SessionControlViewModel,
  SessionWorkspaceActions
} from './session-workspace-model.js'
import './session-control-panel.css'

export function SessionControlPanel(props: {
  model: SessionControlViewModel
  actions: Pick<
    SessionWorkspaceActions,
    'focusScene' | 'setSceneLocation' | 'createGroup'
  >
}) {
  const [editing, setEditing] = useState<'scene' | 'location' | null>(null)
  return (
    <section
      className="session-control-panel"
      aria-label={message('ui.session.steuerung')}
    >
      <div className="panel-heading">
        <h2>{message('ui.session.steuerung')}</h2>
        <button onClick={props.actions.createGroup}>
          {message('group.createAction')}
        </button>
      </div>
      <div className="control-register">
        <div className="register-row active" data-register-field="scene">
          <span className="register-label">{message('ui.szene')}</span>
          {editing === 'scene' ? (
            <span className="register-editor">
              <select
                autoFocus
                aria-label={message('ui.aktive.szene')}
                value={props.model.focusedSceneId}
                onBlur={() => setEditing(null)}
                onChange={(event) => {
                  props.actions.focusScene(event.target.value)
                  setEditing(null)
                }}
              >
                {props.model.scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.title}
                  </option>
                ))}
              </select>
            </span>
          ) : (
            <>
              <span
                className="register-value"
                title={props.model.focusedSceneTitle}
              >
                {props.model.focusedSceneTitle}
              </span>
              <button
                type="button"
                disabled={props.model.scenes.length < 2}
                onClick={() => setEditing('scene')}
              >
                {message('ui.wechseln')}
              </button>
            </>
          )}
        </div>
        <div className="register-row" data-register-field="location">
          <span className="register-label">{message('ui.ort')}</span>
          {editing === 'location' ? (
            <span className="register-editor">
              <select
                autoFocus
                aria-label={message('ui.scene.ort')}
                value={props.model.focusedLocationId ?? ''}
                onBlur={() => setEditing(null)}
                onChange={(event) => {
                  props.actions.setSceneLocation(event.target.value || null)
                  setEditing(null)
                }}
              >
                <option value="">{message('ui.kein.ort')}</option>
                {props.model.focusedLocationId &&
                  props.model.locationUnavailable && (
                    <option value={props.model.focusedLocationId}>
                      {message('ui.nicht.verfuegbarer.ort')}
                    </option>
                  )}
                {props.model.locationChoices.map((choice) => (
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
                  props.model.focusedLocationId ? '' : ' unset'
                }`}
                title={props.model.focusedLocationLabel}
              >
                {props.model.focusedLocationLabel}
              </span>
              <button type="button" onClick={() => setEditing('location')}>
                {message('ui.setzen')}
              </button>
            </>
          )}
        </div>
      </div>
      {props.model.scenes.length > 1 && (
        <p className="panel-hint">{message('session.independentHint')}</p>
      )}
    </section>
  )
}
