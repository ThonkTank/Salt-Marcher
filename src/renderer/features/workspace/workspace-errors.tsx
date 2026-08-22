import { message } from '../../i18n/workspace-runtime.de.js'
import type { WorkspaceUiError } from './use-workspace-errors.js'

export function WorkspaceErrors(props: {
  errors: readonly WorkspaceUiError[]
  dismiss: (id: number) => void
}) {
  if (props.errors.length === 0) return null
  return (
    <div className="workspace-error-stack">
      {props.errors.map((error) => (
        <p
          className="error-message"
          role="alert"
          data-error-scope={error.scope}
          data-error-code={error.code}
          key={error.id}
        >
          <span>{error.message}</span>
          <button className="compact" onClick={() => props.dismiss(error.id)}>
            {message('action.close')}
          </button>
        </p>
      ))}
    </div>
  )
}
