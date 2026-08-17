import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import type { SessionScenario } from '../session/session-scenario.js'

export type WorkspaceSurfaceProps = Readonly<{
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  scenario: SessionScenario
  setScenario: (scenario: SessionScenario) => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
  returnToSession: () => void
}>
