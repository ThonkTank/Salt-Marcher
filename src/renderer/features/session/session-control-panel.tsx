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
  const run = async (operation: () => Promise<LiveSessionSnapshot>) => {
    try {
      props.setSnapshot(await operation())
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
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
      <label>
        {message('ui.aktive.szene')}
        <select
          aria-label={message('ui.aktive.szene')}
          value={props.focused.id}
          disabled={props.snapshot.scene.scenes.length < 2}
          onChange={(event) =>
            void run(() =>
              sessionCapabilities(api).scene.focus(
                event.target.value,
                props.snapshot.scene.revision
              )
            )
          }
        >
          {props.snapshot.scene.scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        {message('ui.ort')}
        <select
          aria-label={message('ui.scene.ort')}
          value={props.focused.locationId ?? ''}
          onChange={(event) =>
            void run(() =>
              sessionCapabilities(api).scene.setLocation(
                props.focused.id,
                event.target.value || null,
                props.snapshot.scene.revision
              )
            )
          }
        >
          <option value="">{message('ui.kein.ort')}</option>
          {props.focused.locationId &&
            !props.snapshot.scene.locationChoices.some(
              (location) => location.id === props.focused.locationId
            ) && (
              <option value={props.focused.locationId}>
                {message('ui.nicht.verfuegbarer.ort')}
              </option>
            )}
          {props.snapshot.scene.locationChoices.map((location) => (
            <option key={location.id} value={location.id}>
              {location.displayName}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-hint">
        {props.snapshot.scene.scenes.length > 1
          ? message('session.independentHint')
          : message('session.additionalHint')}
      </p>
    </section>
  )
}
