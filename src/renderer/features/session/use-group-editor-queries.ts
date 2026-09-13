import type { EvaluateGroupLootInput } from '../../../shared/contracts/loot.js'
import { useEffect, useState } from 'react'
import type { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import type { GroupManagerCommandInput } from './group-manager-command-input.js'
import { editorLootChanges } from './group-editor-loot.js'
import { groupDraftEntries, newGroupDraftKey } from './group-draft.js'

type Input = Pick<
  GroupManagerCommandInput,
  'focused' | 'snapshot' | 'state' | 'session' | 'group' | 'ports' | 'dispatch'
>
export function useGroupEditorQueries(
  input: Input,
  commands: AsyncCommandCoordinator
) {
  const { focused, snapshot, state, session, group, ports, dispatch } = input
  const [revision, changed] = useState(0)
  useEffect(
    () => ports.loot.onChanged?.(() => changed((n) => n + 1)),
    [ports.loot]
  )
  const key = state.activeKey
  const persisted = focused.groups.find((g) => g.id === key)
  useEffect(() => {
    if (!key || !ports.loot.scene) return
    const abort = new AbortController()
    void commands
      .run({
        scope: 'group-manager.editor-treasures',
        mode: 'latest-only',
        signal: abort.signal,
        execute: () => ports.loot.scene!({ sceneId: focused.id })
      })
      .then((outcome) => {
        if (outcome.status === 'success')
          dispatch({
            kind: 'editor-loot-loaded',
            key,
            treasures:
              outcome.value.groupTreasures.find((g) => g.groupId === key)
                ?.treasures ?? []
          })
        else if (outcome.status === 'failure')
          dispatch({
            kind: 'group-message',
            key,
            message: capabilityErrorText(outcome.cause)
          })
      })
    return () => abort.abort()
  }, [commands, dispatch, focused.id, key, ports.loot, revision])
  const request = JSON.stringify({
    sceneId: focused.id,
    groupId: key === newGroupDraftKey ? null : key,
    prospectiveGroupId: state.prospectiveGroupId,
    expectedRevision: snapshot.scene.revision,
    expectedGroupRevision: persisted?.revision ?? null,
    entries: groupDraftEntries(group.quantities, group.deadQuantities),
    treasures: session ? editorLootChanges(session) : [],
    budgetSeed: session?.budgetSeed ?? 0
  })
  const loaded = session?.lootLoaded
  useEffect(() => {
    if (!key || !loaded || !ports.loot.evaluateGroup) return
    const abort = new AbortController()
    dispatch({ kind: 'editor-loot-balance', key, balance: null, error: '' })
    const timer = window.setTimeout(() => {
      void commands
        .run({
          scope: 'group-manager.loot-balance',
          mode: 'latest-only',
          signal: abort.signal,
          execute: () =>
            ports.loot.evaluateGroup!(
              JSON.parse(request) as EvaluateGroupLootInput
            )
        })
        .then((outcome) => {
          if (outcome.status === 'success')
            dispatch({
              kind: 'editor-loot-balance',
              key,
              balance: outcome.value,
              error: ''
            })
          else if (outcome.status === 'failure')
            dispatch({
              kind: 'editor-loot-balance',
              key,
              balance: null,
              error: capabilityErrorText(outcome.cause)
            })
        })
    }, 120)
    return () => {
      window.clearTimeout(timer)
      abort.abort()
    }
  }, [
    commands,
    dispatch,
    key,
    loaded,
    ports.loot,
    request,
    revision,
    snapshot.party.revision
  ])
}
