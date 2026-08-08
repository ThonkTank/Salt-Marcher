import { createMessageFormatter } from './message-runtime.de.js'
import { referenceMessagesDe } from './reference-messages.de.js'
import { uiMessagesDe } from './ui-messages.de.js'
import { workspaceMessagesDe } from './workspace-messages.de.js'

const messages = {
  ...workspaceMessagesDe,
  ...uiMessagesDe,
  ...referenceMessagesDe
} as const
export const { message, formatMessage } = createMessageFormatter(messages)
