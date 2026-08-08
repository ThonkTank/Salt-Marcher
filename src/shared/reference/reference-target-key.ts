import type { ReferenceTarget } from '../contracts/reference.js'

export function referenceTargetKey(target: ReferenceTarget): string {
  switch (target.scope) {
    case 'srd':
      return `srd:${target.catalogId}:${target.definitionKind}:${target.definitionId}`
    case 'creature':
      return `creature:${target.creatureId}`
    case 'creature-part':
      return `creature-part:${target.creatureId}:${target.partKind}:${target.partId}`
    case 'campaign':
      return `campaign:${target.campaignId}:${target.entityKind}:${target.entityId}`
  }
}
