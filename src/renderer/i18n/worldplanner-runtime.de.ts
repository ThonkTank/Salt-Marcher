import { createMessageFormatter } from './message-runtime.de.js'
import { uiMessagesDe } from './ui-messages.de.js'
import { workspaceMessagesDe } from './workspace-messages.de.js'
import { worldplannerMessagesDe } from './worldplanner-messages.de.js'

const messages = {
  ...workspaceMessagesDe,
  ...uiMessagesDe,
  ...worldplannerMessagesDe
} as const
export const { message, formatMessage } = createMessageFormatter(messages)
