import { useState, useRef } from 'react'
import type { CombatCommand } from '../../../shared/contracts/combat-command.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { message } from '../../i18n/session-runtime.de.js'
import type { CombatCommands } from './use-combat-commands.js'

/** The draft belongs to this mounted editor; only its explicit action chooses game effects. */
export function useCombatDraft<Value>(
  commands: CombatCommands,
  label: string,
  source: Value,
  revision: number,
  save?: (
    value: Value,
    current: LiveSessionSnapshot
  ) => CombatCommand['command']
) {
  const draft = useRef<{ value: Value; revision: number } | null>(null)
  const [visibleDraft, setVisibleDraft] = useState<{ value: Value } | null>(
    null
  )
  const clear = () => {
    draft.current = null
    setVisibleDraft(null)
  }
  useMaintenanceDraft({
    label,
    dependsOn: [commands.ownerId],
    isDirty: () => draft.current !== null,
    save: async () => {
      const original = draft.current
      if (!original) return true
      if (!save) throw new Error(message('combat.hpChooseAction'))
      return commands.perform(
        (current) => {
          if (current.combat?.revision !== original.revision)
            throw new Error(message('combat.commandConflict'))
          return save(original.value, current)
        },
        clear,
        true
      )
    },
    discard: () => {
      clear()
      return Promise.resolve(true)
    }
  })
  return {
    value: visibleDraft?.value ?? source,
    clear,
    set: (value: Value) => {
      if (commands.blocked()) return
      draft.current =
        JSON.stringify(value) === JSON.stringify(source)
          ? null
          : { value, revision: draft.current?.revision ?? revision }
      setVisibleDraft(draft.current)
    }
  }
}
