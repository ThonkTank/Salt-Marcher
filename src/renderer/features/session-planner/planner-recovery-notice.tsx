import { message } from '../../i18n/session-runtime.de.js'

export function PlannerRecoveryNotice(props: {
  uncertain: boolean
  canReconcile: boolean
  blocked: boolean
  retry: () => Promise<void>
}) {
  if (!props.uncertain) return null
  return (
    <aside role="status" className="planner-recovery-notice">
      <p>{message('planner.saveUnconfirmed')}</p>
      {props.canReconcile && (
        <button
          type="button"
          disabled={props.blocked}
          onClick={() => void props.retry()}
        >
          {message('planner.checkSavedState')}
        </button>
      )}
    </aside>
  )
}
