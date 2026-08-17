import { lazy, Suspense } from 'react'
import { formatMessage } from '../../i18n/session-runtime.de.js'
import { SessionPartyDialog } from './session-party-dialog.js'
import type {
  SessionWorkspaceActions,
  SessionWorkspaceViewModel
} from './session-workspace-model.js'

const LazyGroupDialog = lazy(async () => {
  const module = await import('./group-dialog.js')
  return { default: module.GroupDialog }
})
const LazyCharacterLootLedgerDialog = lazy(async () => {
  const module = await import('../loot/character-loot-ledger-dialog.js')
  return { default: module.CharacterLootLedgerDialog }
})
const LazyRewardDistributionDialog = lazy(async () => {
  const module = await import('../loot/reward-distribution-dialog.js')
  return { default: module.RewardDistributionDialog }
})
const LazyTreasureEditorDialog = lazy(async () => {
  const module = await import('../loot/treasure-editor-dialog.js')
  return { default: module.TreasureEditorDialog }
})

export function SessionDialogHost(props: {
  model: SessionWorkspaceViewModel
  actions: SessionWorkspaceActions
  onError: (message: string) => void
}) {
  const dialog = props.model.dialog
  if (dialog.kind === 'none') return null
  if (dialog.kind === 'party-editor')
    return (
      <SessionPartyDialog
        snapshot={props.model.snapshot}
        sceneId={props.model.focused.id}
        assign={props.actions.assignPartyMember}
        close={props.actions.closeDialog}
      />
    )
  return (
    <Suspense fallback={null}>
      {dialog.kind === 'group-editor' && (
        <LazyGroupDialog
          snapshot={props.model.snapshot}
          group={dialog.group}
          close={props.actions.closeDialog}
          saved={props.actions.groupSaved}
          lootChanged={props.actions.lootChanged}
          inspect={(creature) =>
            props.actions.inspectCreature(
              creature.id,
              formatMessage('reference.catalogCreature', {
                name: creature.name
              })
            )
          }
          onError={props.onError}
          reinforcementMode={dialog.reinforcement}
        />
      )}
      {dialog.kind === 'character-ledger' && (
        <LazyCharacterLootLedgerDialog
          character={dialog.character}
          close={props.actions.closeDialog}
          onError={props.onError}
        />
      )}
      {dialog.kind === 'reward-distribution' && (
        <LazyRewardDistributionDialog
          treasure={dialog.treasure}
          snapshot={props.model.snapshot}
          close={props.actions.closeDialog}
          completed={() => {
            props.actions.lootChanged()
            props.actions.closeDialog()
          }}
          onError={props.onError}
        />
      )}
      {dialog.kind === 'treasure-editor' && (
        <LazyTreasureEditorDialog
          snapshot={props.model.snapshot}
          initialAnchor={dialog.anchor}
          treasure={dialog.treasure}
          close={props.actions.closeDialog}
          saved={() => {
            props.actions.lootChanged()
            props.actions.closeDialog()
          }}
          onError={props.onError}
        />
      )}
    </Suspense>
  )
}
