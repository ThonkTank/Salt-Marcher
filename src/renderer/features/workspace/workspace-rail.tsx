import { message } from '../../i18n/workspace-runtime.de.js'
import saltMarcherLogo from '../../assets/icons/salt-marcher.svg?url'
import {
  workspaceDefinitions,
  type WorkspaceId
} from './workspace-definition.js'

export function WorkspaceRail(props: {
  active: boolean
  workspace: WorkspaceId
  select: (workspace: WorkspaceId) => void
}) {
  return (
    <nav className="icon-bar" aria-label={message('app.workspaces')}>
      {props.active &&
        workspaceDefinitions.map((item) => (
          <button
            key={item.id}
            className="icon-button"
            aria-label={message(item.label)}
            title={message(item.label)}
            aria-pressed={props.workspace === item.id}
            onClick={() => props.select(item.id)}
          >
            <img src={item.icon} alt="" aria-hidden="true" />
          </button>
        ))}
      <img
        className="rail-logo"
        src={saltMarcherLogo}
        alt={message('ui.saltmarcher')}
      />
    </nav>
  )
}
