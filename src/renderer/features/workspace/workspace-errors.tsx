import { message } from '../../i18n/workspace-runtime.de.js'
import type { WorkspaceUiError } from './use-workspace-errors.js'

export function WorkspaceErrors(props: {
  errors: readonly WorkspaceUiError[]
  dismiss: (id: number) => void
}) {
  return props.errors.map((error) => (
    <p
      className="error-message"
      role="alert"
      data-error-scope={error.scope}
      data-error-code={error.code}
      key={error.id}
    >
      {error.message}{' '}
      <button className="compact" onClick={() => props.dismiss(error.id)}>
        {message('action.close')}
      </button>
    </p>
  ))
}
