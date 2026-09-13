import './group-editor-quantity.css'
import { formatMessage } from '../../i18n/session-runtime.de.js'
export function GroupEditorQuantity(props: {
  name: string
  quantity: number
  minimum?: number
  maximum?: number
  disabled?: boolean
  change: (delta: number) => void
  remove?: () => void
  canRemove?: boolean
}) {
  return (
    <span className="group-editor-quantity">
      <button
        type="button"
        disabled={props.disabled || props.quantity <= (props.minimum ?? 0)}
        aria-label={formatMessage('groupEditor.decrease', { name: props.name })}
        onClick={() => props.change(-1)}
      >
        −
      </button>
      <output>{props.quantity}</output>
      <button
        type="button"
        disabled={props.disabled || props.quantity >= (props.maximum ?? 999)}
        aria-label={formatMessage('groupEditor.increase', { name: props.name })}
        onClick={() => props.change(1)}
      >
        +
      </button>
      {props.remove && (
        <button
          type="button"
          disabled={props.disabled || props.canRemove === false}
          aria-label={formatMessage('groupEditor.remove', { name: props.name })}
          onClick={props.remove}
        >
          ×
        </button>
      )}
    </span>
  )
}
