import { useMemo, useSyncExternalStore } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { InlineGroupCommands } from './inline-group-commands.js'
import { message } from '../../i18n/session-runtime.de.js'

export function useInlineGroupCommands(input: {
  campaignId: string
  sceneId: string
  applied: (snapshot: LiveSessionSnapshot) => void
}) {
  const api = useCapabilityApi()
  const commands = useMemo(
    () =>
      new InlineGroupCommands(
        api,
        input.campaignId,
        input.sceneId,
        input.applied
      ),
    [api, input.campaignId, input.sceneId, input.applied]
  )
  const state = useSyncExternalStore(commands.subscribe, commands.snapshot)
  return {
    change: (groupId: string, creatureId: string, delta: number | null) =>
      commands.enqueue(groupId, creatureId, delta),
    notice: state.error ? (
      <aside role="alert">
        {state.error}
        {state.held.map((id) => (
          <span key={id}>
            <button type="button" onClick={() => void commands.retry(id)}>
              {message('group.retryLifecycle')}
            </button>
            <button type="button" onClick={() => void commands.discard(id)}>
              {message('group.discardLifecycle')}
            </button>
          </span>
        ))}
      </aside>
    ) : null
  }
}
