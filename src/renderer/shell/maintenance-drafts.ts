import { useEffect, useId } from 'react'
const drafts = new Set<string>()
/** Editors retain ownership of save/discard; maintenance never throws their state away. */
export function useMaintenanceDraftGuard(dirty: boolean): void {
  const id = useId()
  useEffect(() => {
    if (dirty) drafts.add(id)
    else drafts.delete(id)
    return () => {
      drafts.delete(id)
    }
  }, [dirty, id])
}
export function hasMaintenanceDrafts(): boolean {
  return drafts.size > 0
}
