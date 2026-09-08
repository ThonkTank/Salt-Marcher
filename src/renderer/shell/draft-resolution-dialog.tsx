import { ModalDialog } from './modal-dialog.js'
import { message } from '../i18n/campaign-menu-runtime.de.js'
import './release-settings.css'

export function DraftResolutionDialog(props: {
  title: string
  text: string
  errors: readonly { id: string; text: string }[]
  needsDrafts: boolean
  busy: boolean
  cancel: () => void
  confirm: (choice?: 'save' | 'discard') => void
}) {
  return (
    <ModalDialog
      className="release-settings"
      ariaLabel={props.title}
      role="alertdialog"
      onClose={props.cancel}
      busy={props.busy}
    >
      <p>{props.text}</p>
      {props.errors.length > 0 && (
        <div role="alert">
          {props.errors.map((failure) => (
            <p key={failure.id}>{failure.text}</p>
          ))}
          <p>{message('draft.retry')}</p>
        </div>
      )}
      <button disabled={props.busy} onClick={props.cancel}>
        {message('action.cancel')}
      </button>
      {props.needsDrafts ? (
        <>
          <button disabled={props.busy} onClick={() => props.confirm('save')}>
            {message('draft.save')}
          </button>
          <button
            disabled={props.busy}
            onClick={() => props.confirm('discard')}
          >
            {message('draft.discard')}
          </button>
        </>
      ) : (
        <button disabled={props.busy} onClick={() => props.confirm()}>
          {message('draft.confirm')}
        </button>
      )}
    </ModalDialog>
  )
}
