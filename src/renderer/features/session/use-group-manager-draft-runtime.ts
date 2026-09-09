import { useEffect, useState, useSyncExternalStore } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { createGroupManagerState } from './group-manager-state.js'
import { GroupManagerDraftRuntime } from './group-manager-draft-runtime.js'

export function useGroupManagerDraftRuntime(
  initial: Omit<
    Parameters<typeof createGroupManagerState>[0],
    'prospectiveGroupId'
  >,
  external: LiveSessionSnapshot
) {
  const [runtime] = useState(
    () =>
      new GroupManagerDraftRuntime(
        createGroupManagerState({
          ...initial,
          prospectiveGroupId: crypto.randomUUID()
        }),
        external
      )
  )
  const current = useSyncExternalStore(runtime.subscribe, runtime.snapshot)
  useEffect(() => runtime.acceptSnapshot(external), [external, runtime])
  return { runtime, ...current }
}
