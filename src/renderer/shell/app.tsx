import { useCapabilityApi } from '../capabilities/use-capability-api.js'
import { ModuleHost } from './module-host.js'
import { shellMessagesDe } from '../i18n/shell-messages.de.js'

const loadWorkspace = async () => {
  const module = await import('../features/workspace/workspace.js')
  return { default: module.WorkspaceApp }
}

/** Global renderer boundary; feature state lives below the workspace route. */
export function App() {
  const api = useCapabilityApi()
  return (
    <ModuleHost
      workspace="application"
      load={loadWorkspace}
      componentProps={{}}
      loadingMessage={shellMessagesDe.loading}
      failureMessage={shellMessagesDe.loadFailed}
      recoveryMessage={shellMessagesDe.recovery}
      retryLabel={shellMessagesDe.retry}
      reloadLabel={shellMessagesDe.reload}
      recoveryPolicy={{
        moduleFailure: 'retry-or-reload',
        renderFailure: 'remount'
      }}
      reportIncident={(incident) =>
        api.runtime.reportRendererIncident(incident)
      }
      reloadRenderer={() => api.runtime.reloadRenderer()}
    />
  )
}
