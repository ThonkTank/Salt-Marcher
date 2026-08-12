import { createMessageFormatter } from './message-runtime.de.js'
import { sessionMessagesDe } from './session-messages.de.js'
import { uiMessagesDe } from './ui-messages.de.js'
import { workspaceMessagesDe } from './workspace-messages.de.js'
import { lootMessagesDe } from './loot-messages.de.js'
import { sessionPlannerMessagesDe } from './session-planner-messages.de.js'

const messages = {
  ...workspaceMessagesDe,
  ...uiMessagesDe,
  ...sessionMessagesDe,
  ...lootMessagesDe,
  ...sessionPlannerMessagesDe
} as const
export const { message, formatMessage } = createMessageFormatter(messages)
