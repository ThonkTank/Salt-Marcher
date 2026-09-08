import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { desktopProjection } from './desktop-projection.js'

export function useSceneDesktop(campaignId: string, sceneId: string) {
  const api = useCapabilityApi()
  const projection = useMemo(
    () => desktopProjection(api.sceneDesktop, { campaignId, sceneId }),
    [api.sceneDesktop, campaignId, sceneId]
  )
  const snapshot = useSyncExternalStore(
    projection.subscribe,
    projection.snapshot
  )
  useEffect(() => {
    void projection.load()
  }, [projection])
  return { projection, snapshot }
}
