import { useContext, type ReactNode } from 'react'
import { DesktopTitleActionsContext } from './desktop-title-actions-context.js'
import { createPortal } from 'react-dom'
export function DesktopTitleActions({ children }: { children: ReactNode }) {
  const target = useContext(DesktopTitleActionsContext)
  return target ? createPortal(children, target) : null
}
