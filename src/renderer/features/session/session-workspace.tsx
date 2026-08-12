import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import { message } from '../../i18n/session-runtime.de.js'
import { useReferenceContext } from '../reference/reference-context.js'
import { SessionCenterPanel } from './session-center-panel.js'
import { SessionControlPanel } from './session-control-panel.js'
import { SessionDialogHost } from './session-dialog-host.js'
import { SessionGroupsPanel } from './session-groups-panel.js'
import { SessionPanelLayout } from './session-panel-layout.js'
import { SessionScenarioPanel } from './session-scenario-panel.js'
import type { SessionTravelSlots } from './session-travel-slots.js'
import type {
  Treasure,
  TreasureAnchor
} from '../../../shared/contracts/loot.js'
import './session-workspace.css'
import { useLootSceneController } from '../loot/use-loot-scene-controller.js'

const LazyRewardDistributionDialog = lazy(async () => {
  const module = await import('../loot/reward-distribution-dialog.js')
  return { default: module.RewardDistributionDialog }
})
const LazyTreasureEditorDialog = lazy(async () => {
  const module = await import('../loot/treasure-editor-dialog.js')
  return { default: module.TreasureEditorDialog }
})

export default function SessionWorkspace(props: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  groupDialogOpen: boolean
  setGroupDialogOpen: (open: boolean) => void
  scenario: '' | 'encounter' | 'travel'
  setScenario: (scenario: '' | 'encounter' | 'travel') => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  onError: (message: string) => void
  travel: SessionTravelSlots
}) {
  const [editingGroup, setEditingGroup] = useState<SceneGroup | null>(null)
  const [reinforcementMode, setReinforcementMode] = useState(false)
  const [distributionTreasure, setDistributionTreasure] =
    useState<Treasure | null>(null)
  const [treasureEditor, setTreasureEditor] = useState<{
    anchor: TreasureAnchor
    treasure: Treasure | null
  } | null>(null)
  const followedCombatCard = useRef<string | null>(null)
  const reference = useReferenceContext()
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const lootController = useLootSceneController({
    sceneId: focused.id,
    locationId: focused.locationId,
    onError: props.onError
  })
  const loot = lootController.scene
  const refreshLoot = lootController.refresh

  function openCreature(creatureId: string, context: string) {
    reference.openReference(
      { scope: 'creature', creatureId },
      `${context} › Kreatur`
    )
  }

  function openGroupDialog(group: SceneGroup | null, reinforcement: boolean) {
    setEditingGroup(group)
    setReinforcementMode(reinforcement)
    props.setGroupDialogOpen(true)
  }

  const activeCombatCard = props.snapshot.combat?.cards.find(
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
    openCreature(activeCombatCard.creatureId, group?.name ?? 'Encounter')
    // The active card identity deliberately controls this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCombatCard?.id, activeCombatCard?.creatureId])

  const control = (
    <SessionControlPanel
      snapshot={props.snapshot}
      focused={focused}
      setSnapshot={props.setSnapshot}
      onError={props.onError}
      manageGroups={() => openGroupDialog(null, false)}
    />
  )
  const groups = (
    <SessionGroupsPanel
      snapshot={props.snapshot}
      loot={loot}
      lootInbox={lootController.inbox}
      lootInboxOpen={lootController.inboxOpen}
      openLootInbox={() => void lootController.openInbox()}
      loadMoreLoot={() => void lootController.loadMore()}
      focused={focused}
      setSnapshot={props.setSnapshot}
      onError={props.onError}
      inspect={openCreature}
      edit={(group) => openGroupDialog(group, false)}
      distribute={setDistributionTreasure}
      createLoot={(anchor) => setTreasureEditor({ anchor, treasure: null })}
      editLoot={(treasure) =>
        setTreasureEditor({ anchor: treasure.anchor, treasure })
      }
    />
  )
  const details = (
    <SessionCenterPanel
      focused={focused}
      layout={props.layout}
      setLayout={props.setLayout}
      travel={props.travel}
      onError={props.onError}
      inspectCreature={openCreature}
    />
  )
  const scenario = (
    <SessionScenarioPanel
      snapshot={props.snapshot}
      loot={loot}
      setSnapshot={props.setSnapshot}
      scenario={props.scenario}
      setScenario={props.setScenario}
      layout={props.layout}
      setLayout={props.setLayout}
      onError={props.onError}
      travel={props.travel}
      openReference={reference.openReference}
      manageGroups={() => openGroupDialog(null, false)}
      reinforce={() => openGroupDialog(null, true)}
      distribute={setDistributionTreasure}
    />
  )

  return (
    <section
      className="session-mockup"
      aria-label={message('ui.session.workspace')}
    >
      <div className="session-layout">
        <SessionPanelLayout
          preference={props.layout}
          changed={props.setLayout}
          control={control}
          groups={groups}
          details={details}
          scenario={scenario}
        />
      </div>
      <SessionDialogHost
        snapshot={props.snapshot}
        group={editingGroup}
        open={props.groupDialogOpen}
        close={() => props.setGroupDialogOpen(false)}
        saved={(snapshot) => {
          props.setSnapshot(snapshot)
          void refreshLoot()
          props.setGroupDialogOpen(false)
        }}
        lootChanged={() => void refreshLoot()}
        inspect={(creatureId, creatureName) =>
          reference.openReference(
            { scope: 'creature', creatureId },
            `Katalog › ${creatureName}`
          )
        }
        onError={props.onError}
        reinforcementMode={reinforcementMode}
      />
      <Suspense fallback={null}>
        {distributionTreasure && (
          <LazyRewardDistributionDialog
            treasure={distributionTreasure}
            snapshot={props.snapshot}
            close={() => setDistributionTreasure(null)}
            completed={() => {
              void refreshLoot()
              setDistributionTreasure(null)
            }}
            onError={props.onError}
          />
        )}
        {treasureEditor && (
          <LazyTreasureEditorDialog
            snapshot={props.snapshot}
            initialAnchor={treasureEditor.anchor}
            treasure={treasureEditor.treasure}
            close={() => setTreasureEditor(null)}
            saved={() => {
              void refreshLoot()
              setTreasureEditor(null)
            }}
            onError={props.onError}
          />
        )}
      </Suspense>
    </section>
  )
}
