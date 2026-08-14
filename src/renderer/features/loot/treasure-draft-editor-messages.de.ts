import { message } from '../../i18n/session-runtime.de.js'
import type { TreasureDraftEditorMessages } from './treasure-draft-fields.js'

export function treasureDraftEditorMessagesDe(): TreasureDraftEditorMessages {
  return {
    label: message('loot.label'),
    container: message('loot.container'),
    capacity: message('loot.capacity'),
    item: message('loot.item'),
    quantity: message('loot.quantity'),
    valueCopper: message('loot.valueCopper'),
    valueCopperLabel: message('loot.valueCopperLabel'),
    stackable: message('loot.stackable'),
    noContainer: message('loot.noContainer'),
    removeContainer: message('loot.removeContainer'),
    removeItem: message('loot.removeItem'),
    addContainer: message('loot.addContainer'),
    addItem: message('loot.addItem'),
    invalidField: message('loot.draftInvalid')
  }
}
