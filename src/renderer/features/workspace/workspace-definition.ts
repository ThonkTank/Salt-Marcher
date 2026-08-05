import type { PlainMessageKey } from '../../i18n/messages.de.js'
import type { SurfaceId } from '../../shell/module-host.js'
import sessionIcon from '../../assets/icons/session.svg?url'
import hexIcon from '../../assets/icons/hex.svg?url'
import catalogIcon from '../../assets/icons/catalog.svg?url'

export type WorkspaceId = Exclude<SurfaceId, 'application'>

export type WorkspaceDefinition = Readonly<{
  id: WorkspaceId
  label: PlainMessageKey
  icon: string
  layout: 'session' | 'document'
}>

export const workspaceDefinitions: readonly WorkspaceDefinition[] = [
  { id: 'session', label: 'nav.session', icon: sessionIcon, layout: 'session' },
  { id: 'hex', label: 'nav.hex', icon: hexIcon, layout: 'document' },
  { id: 'catalog', label: 'nav.catalog', icon: catalogIcon, layout: 'document' }
]

export function workspaceDefinition(id: WorkspaceId): WorkspaceDefinition {
  return workspaceDefinitions.find((definition) => definition.id === id)!
}
