import type { SurfaceId } from '../../shell/module-host.js'
import type { ModuleRecoveryPolicy } from '../../shell/module-host.js'
import type { ComponentType } from 'react'
import type { WorkspaceSurfaceProps } from './workspace-surface-props.js'
import sessionIcon from '../../assets/icons/session.svg?url'
import hexIcon from '../../assets/icons/hex.svg?url'
import catalogIcon from '../../assets/icons/catalog.svg?url'
import plannerIcon from '../../assets/icons/planner.svg?url'

export type WorkspaceId = Exclude<SurfaceId, 'application'>

export type WorkspaceDefinition = Readonly<{
  id: WorkspaceId
  label: 'nav.session' | 'nav.planner' | 'nav.hex' | 'nav.catalog'
  icon: string
  layout: 'cockpit' | 'scroll'
  load: () => Promise<{ default: ComponentType<WorkspaceSurfaceProps> }>
  recovery: ModuleRecoveryPolicy
}>

const recoverToSession: ModuleRecoveryPolicy = {
  moduleFailure: 'retry-or-reload',
  renderFailure: 'remount-or-return'
}

export const workspaceDefinitions: readonly WorkspaceDefinition[] = [
  {
    id: 'session',
    label: 'nav.session',
    icon: sessionIcon,
    layout: 'cockpit',
    load: () => import('./surfaces/session-surface.js'),
    recovery: { ...recoverToSession, renderFailure: 'remount' }
  },
  {
    id: 'planner',
    label: 'nav.planner',
    icon: plannerIcon,
    layout: 'cockpit',
    load: () => import('./surfaces/planner-surface.js'),
    recovery: recoverToSession
  },
  {
    id: 'hex',
    label: 'nav.hex',
    icon: hexIcon,
    layout: 'cockpit',
    load: () => import('./surfaces/hex-surface.js'),
    recovery: recoverToSession
  },
  {
    id: 'catalog',
    label: 'nav.catalog',
    icon: catalogIcon,
    layout: 'scroll',
    load: () => import('./surfaces/catalog-surface.js'),
    recovery: recoverToSession
  }
]

export function workspaceDefinition(id: WorkspaceId): WorkspaceDefinition {
  return workspaceDefinitions.find((definition) => definition.id === id)!
}
