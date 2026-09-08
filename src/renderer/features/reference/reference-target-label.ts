import type { ReferenceTarget } from '../../../shared/contracts/reference.js'
import { message } from '../../i18n/reference-runtime.de.js'

export function referenceTargetLabel(target: ReferenceTarget): string {
  const labels = {
    rule: message('reference.kind.rule'),
    condition: message('reference.kind.condition'),
    spell: message('reference.kind.spell'),
    item: message('reference.kind.item'),
    ability: message('reference.kind.ability'),
    action: message('reference.kind.action'),
    creature: message('reference.kind.creature'),
    location: message('reference.kind.location'),
    faction: message('reference.kind.faction'),
    npc: message('reference.kind.npc')
  }
  if (target.scope === 'srd') return labels[target.definitionKind]
  if (target.scope === 'creature') return labels.creature
  if (target.scope === 'creature-part')
    return target.partKind === 'trait' ? labels.ability : labels.action
  return labels[target.entityKind]
}
