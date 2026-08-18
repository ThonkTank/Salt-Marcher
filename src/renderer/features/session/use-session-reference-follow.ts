import { useCallback, useEffect, useRef } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { ReferenceContextValue } from '../reference/reference-context.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'

export function useSessionReferenceFollow(input: {
  snapshot: LiveSessionSnapshot
  reference: ReferenceContextValue
}) {
  const followedCombatCard = useRef<string | null>(null)
  const focused = input.snapshot.scene.scenes.find(
    (scene) => scene.id === input.snapshot.scene.focusedSceneId
  )!
  const openCreature = useCallback(
    (creatureId: string, context: string) =>
      input.reference.openReference(
        { scope: 'creature', creatureId },
        formatMessage('reference.contextCreature', { context })
      ),
    [input.reference]
  )
  const activeCombatCard = input.snapshot.combat?.cards.find(
    (card) => card.active && !card.playerCharacter && card.creatureId
  )

  useEffect(() => {
    if (!activeCombatCard?.creatureId) {
      followedCombatCard.current = null
      return
    }
    if (followedCombatCard.current === activeCombatCard.id) return
    followedCombatCard.current = activeCombatCard.id
    const group = focused.groups.find((candidate) =>
      candidate.entries.some(
        (entry) => entry.creatureId === activeCombatCard.creatureId
      )
    )
    openCreature(
      activeCombatCard.creatureId,
      group?.name ?? message('ui.encounter')
    )
  }, [
    activeCombatCard?.creatureId,
    activeCombatCard?.id,
    focused.groups,
    openCreature
  ])

  return { openCreature }
}
