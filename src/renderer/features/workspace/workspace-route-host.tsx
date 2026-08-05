import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { WorkspaceSurfaceProps } from './workspace-surface-props.js'
import { formatMessage, message } from '../../i18n/messages.de.js'
import { ModuleHost } from '../../shell/module-host.js'
import {
  workspaceDefinition,
  type WorkspaceId
} from './workspace-definition.js'

export function WorkspaceRouteHost(props: {
  active: boolean
  workspace: WorkspaceId
  readbackKey: number
  surfaceProps: WorkspaceSurfaceProps | null
  runtime: SaltMarcherApi['runtime']
}) {
  if (!props.active || !props.surfaceProps)
    return (
      <section className="campaign-idle" aria-live="polite">
        <p className="section-kicker">{message('campaign.archive')}</p>
        <h2>{message('campaign.choose')}</h2>
        <p>{message('campaign.menuHint')}</p>
      </section>
    )

  const definition = workspaceDefinition(props.workspace)
  return (
    <ModuleHost
      key={`${definition.id}-boundary-${props.readbackKey}`}
      workspace={definition.id}
      load={definition.load}
      componentProps={props.surfaceProps}
      loadingMessage={formatMessage('workspace.loading', {
        name: message(definition.label)
      })}
      failureMessage={formatMessage('workspace.loadFailed', {
        name: message(definition.label)
      })}
      recoveryMessage={message('workspace.reloadHint')}
      retryLabel={message('action.retryWorkspace')}
      reloadLabel={message('action.reloadApplication')}
      recoveryPolicy={definition.recovery}
      returnLabel={message('nav.session')}
      returnToSafeSurface={props.surfaceProps.returnToSession}
      reportIncident={(incident) =>
        props.runtime.reportRendererIncident(incident)
      }
      reloadRenderer={() => props.runtime.reloadRenderer()}
    />
  )
}
