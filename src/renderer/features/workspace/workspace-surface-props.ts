import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'

export type WorkspaceScenario = 'encounter' | 'travel'

export type WorkspaceSurfaceProps = Readonly<{
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  groupDialogOpen: boolean
  setGroupDialogOpen: (open: boolean) => void
  scenario: WorkspaceScenario
  setScenario: (scenario: WorkspaceScenario) => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
  returnToSession: () => void
}>
