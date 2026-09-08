import { createContext, useContext } from 'react'
import type {
  ReferenceDocument,
  ReferenceTarget
} from '../../../shared/contracts/reference.js'
import type {
  CompiledReferenceIndex,
  ReferenceMatch
} from './reference-matcher.js'

export type ReferenceOverlayCard = Readonly<{
  id: string
  parentId: string | null
  anchor: HTMLElement
  match: ReferenceMatch
  path: readonly ReferenceTarget[]
  scopeKey: string
}>

export type ReferenceContextValue = Readonly<{
  compiled: readonly CompiledReferenceIndex[] | null
  campaignId: string | null
  loadDetail(target: ReferenceTarget): Promise<ReferenceDocument>
  openReference(target: ReferenceTarget, breadcrumb: string): void
  openOverlay(
    anchor: HTMLElement,
    match: ReferenceMatch,
    path: readonly ReferenceTarget[],
    parentId?: string
  ): void
  closeOverlayBranch(parentId?: string): void
  scheduleOverlayClose(parentId?: string): void
  cancelOverlayClose(): void
  overlays: readonly ReferenceOverlayCard[]
  openSeparateReference(target: ReferenceTarget): void
  cacheRevision: number
}>

export const ReferenceContext = createContext<ReferenceContextValue | null>(
  null
)
export const ReferenceOverlayParentContext = createContext<string | undefined>(
  undefined
)

export function useReferenceContext(): ReferenceContextValue {
  const context = useContext(ReferenceContext)
  if (!context)
    throw new Error('Reference components require ReferenceProvider')
  return context
}

export function useOptionalReferenceContext(): ReferenceContextValue | null {
  return useContext(ReferenceContext)
}
