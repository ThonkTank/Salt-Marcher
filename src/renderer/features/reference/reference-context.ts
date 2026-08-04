import { createContext, useContext } from 'react'
import type {
  ReferenceDocument,
  ReferenceTarget
} from '../../../shared/contracts/reference.js'
import type { CompiledReferenceIndex } from './reference-matcher.js'

export type PinnedReference = Readonly<{
  id: string
  target: ReferenceTarget
  title: string
  x: number
  y: number
  z: number
}>

export type ReferenceContextValue = Readonly<{
  compiled: CompiledReferenceIndex | null
  campaignId: string | null
  loadDetail(target: ReferenceTarget): Promise<ReferenceDocument>
  openReference(target: ReferenceTarget, breadcrumb: string): void
  pinReference(
    target: ReferenceTarget,
    title: string,
    anchor: Readonly<{ right: number; top: number }> | null
  ): void
  closePin(id: string): void
  movePin(id: string, x: number, y: number): void
  raisePin(id: string): void
  pins: readonly PinnedReference[]
}>

export const ReferenceContext = createContext<ReferenceContextValue | null>(
  null
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
