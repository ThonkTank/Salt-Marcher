import { capabilityErrorCode } from '../../shared/errors/capability-error.js'
import { createMessageFormatter } from './message-runtime.de.js'
import type {
  MessageKey,
  MessageParameters,
  ParameterizedMessageKey,
  PlainMessageKey
} from './message-types.de.js'
import { uiMessagesDe } from './ui-messages.de.js'
import { workspaceMessagesDe } from './workspace-messages.de.js'

const messages = { ...workspaceMessagesDe, ...uiMessagesDe } as const
export const { message, formatMessage } = createMessageFormatter(messages)
export type {
  MessageKey,
  MessageParameters,
  ParameterizedMessageKey,
  PlainMessageKey
}

export function capabilityErrorMessage(error: unknown): string {
  const code = capabilityErrorCode(error)
  return code === null ? message('error.unknown') : message(`error.${code}`)
}
