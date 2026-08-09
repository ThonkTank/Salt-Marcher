import type { catalogMessagesDe } from './catalog-messages.de.js'
import type { campaignMenuMessagesDe } from './campaign-menu-messages.de.js'
import type { hexMessagesDe } from './hex-messages.de.js'
import type { generatorMessagesDe } from './generator-messages.de.js'
import type { referenceMessagesDe } from './reference-messages.de.js'
import type { sessionMessagesDe } from './session-messages.de.js'
import type { uiMessagesDe } from './ui-messages.de.js'
import type { workspaceMessagesDe } from './workspace-messages.de.js'
import type { worldplannerMessagesDe } from './worldplanner-messages.de.js'

type MessagesDe = typeof workspaceMessagesDe &
  typeof campaignMenuMessagesDe &
  typeof generatorMessagesDe &
  typeof referenceMessagesDe &
  typeof sessionMessagesDe &
  typeof hexMessagesDe &
  typeof catalogMessagesDe &
  typeof worldplannerMessagesDe &
  typeof uiMessagesDe

export type MessageKey = keyof MessagesDe

type PlaceholderNames<Value extends string> =
  Value extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PlaceholderNames<Rest>
    : never

export type PlainMessageKey = {
  [Key in MessageKey]: PlaceholderNames<MessagesDe[Key]> extends never
    ? Key
    : never
}[MessageKey]

export type ParameterizedMessageKey = Exclude<MessageKey, PlainMessageKey>

export type MessageParameters<Key extends ParameterizedMessageKey> = Readonly<
  Record<PlaceholderNames<MessagesDe[Key]>, string | number>
>
