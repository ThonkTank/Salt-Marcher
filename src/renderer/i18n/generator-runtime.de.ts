import { createMessageFormatter } from './message-runtime.de.js'
import { generatorMessagesDe } from './generator-messages.de.js'

const messages = {
  ...generatorMessagesDe,
  'action.close': 'Schließen',
  'menu.settings': 'Einstellungen'
} as const

export const { message, formatMessage } = createMessageFormatter(messages)
