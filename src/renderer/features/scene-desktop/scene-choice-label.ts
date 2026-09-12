import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'

export function sceneChoiceLabel(
  id: string,
  snapshot: LiveSessionSnapshot
): string {
  const labels = snapshot.scene.scenes.map((scene) => ({
    id: scene.id,
    label: `${scene.locationName || 'Unbekannter Ort'} · ${scene.partyMemberIds.map((id) => snapshot.party.members.find((member) => member.id === id)?.name ?? '—').join(', ') || 'Leer'}`
  }))
  const choice = labels.find((scene) => scene.id === id)!
  return labels.filter((scene) => scene.label === choice.label).length > 1
    ? `${choice.label} · ${id.slice(-6)}`
    : choice.label
}
