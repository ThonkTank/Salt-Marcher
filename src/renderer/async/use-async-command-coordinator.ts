import { useEffect, useState, useSyncExternalStore } from 'react'
import { AsyncCommandCoordinator } from './async-command-coordinator.js'

/** Owns one renderer-infrastructure coordinator for a mounted consumer. */
export function useAsyncCommandCoordinator(): AsyncCommandCoordinator {
  const [coordinator] = useState(() => new AsyncCommandCoordinator())
  useSyncExternalStore(
    coordinator.subscribe,
    coordinator.snapshot,
    coordinator.snapshot
  )
  useEffect(() => () => coordinator.cancelAll(), [coordinator])
  return coordinator
}
