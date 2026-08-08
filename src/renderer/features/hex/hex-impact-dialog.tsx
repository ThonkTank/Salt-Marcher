import type { HexEraseImpact } from '../../../shared/contracts/hex.js'
import { formatMessage, message } from '../../i18n/hex-runtime.de.js'
import { ModalDialog } from '../../shell/modal-dialog.js'

export function HexImpactDialog(props: {
  impact: HexEraseImpact
  cancel: () => void
  confirm: () => void
}) {
  return (
    <ModalDialog
      className="hex-erase-dialog"
      ariaLabel={message('hex.eraseTitle')}
      onClose={props.cancel}
    >
      <h2>{message('hex.eraseTitle')}</h2>
      <p>{message('hex.eraseBody')}</p>
      <ul>
        {props.impact.locations.map((location) => (
          <li key={location.locationId}>
            {formatMessage('hex.impact.location', {
              name: location.displayName
            })}
          </li>
        ))}
        {props.impact.journeys.map((journey) => (
          <li key={journey.sceneId}>
            {formatMessage('hex.impact.journey', {
              id: journey.sceneId.slice(0, 8)
            })}
          </li>
        ))}
        {props.impact.partyMembers.map((member) => (
          <li key={member.memberId}>
            {formatMessage('hex.impact.party', { name: member.displayName })}
          </li>
        ))}
      </ul>
      <div className="row-actions">
        <button onClick={props.cancel}>{message('action.cancel')}</button>
        <button className="danger" onClick={props.confirm}>
          {message('hex.eraseConfirm')}
        </button>
      </div>
    </ModalDialog>
  )
}
