import { describe, expect, it } from 'vitest'
import { partyFieldValues } from '../../src/renderer/features/scene-desktop/party-fields.js'
import { droppableGroup } from '../../src/renderer/features/scene-desktop/desktop-group-drop.js'
import {
  initialDesktopState,
  reduceDesktop
} from '../../src/renderer/features/scene-desktop/desktop-state.js'
import {
  readStoredDesktopState,
  sceneDesktopStateSchema
} from '../../src/shared/contracts/scene-desktop.js'
import {
  installationPreferencesSchema,
  installationPreferencesPatchSchema
} from '../../src/shared/contracts/settings.js'
import type { PartyCharacter } from '../../src/shared/contracts/party.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
const campaignId = '00000000-0000-4000-8000-000000000001'
const sceneId = '00000000-0000-4000-8000-000000000002'
const groupId = '00000000-0000-4000-8000-000000000003'
describe('party and group desktop contracts', () => {
  it('migrates old overview geometry and leaves intentionally closed desktops closed', () => {
    const oldWindow = {
      ...initialDesktopState().windows[0]!,
      id: 'overview',
      kind: 'overview',
      minimized: true
    }
    const old = {
      ...initialDesktopState(),
      schemaVersion: 4,
      windows: [oldWindow],
      combatSelection: [groupId]
    }
    const next = readStoredDesktopState(old)
    expect(next.windows.map((w) => w.kind)).toEqual(['party', 'groups'])
    expect(next.windows.every((w) => w.minimized)).toBe(true)
    expect(next.windows[0]?.bounds).toEqual(oldWindow.bounds)
    expect(next.combatSelection).toEqual([groupId])
    expect(readStoredDesktopState(next)).toEqual(next)
    expect(readStoredDesktopState({ ...old, windows: [] }).windows).toEqual([])
    expect(
      sceneDesktopStateSchema.safeParse({ ...next, windows: [oldWindow] })
        .success
    ).toBe(false)
  })
  it('reopens each singleton independently', () => {
    let state = initialDesktopState()
    state = reduceDesktop(state, { type: 'close', id: 'party' })
    expect(state.windows.map((w) => w.kind)).toEqual(['groups'])
    state = reduceDesktop(state, { type: 'open-party' })
    state = reduceDesktop(state, { type: 'open-party' })
    expect(state.windows.filter((w) => w.kind === 'party')).toHaveLength(1)
  })
  it('defaults old settings, validates field keys and does not reset quick fields on theme patches', () => {
    expect(
      installationPreferencesSchema.parse({ theme: 'dark' }).partyQuickFields
    ).toEqual(['armorClass', 'passivePerception'])
    expect(
      installationPreferencesPatchSchema.parse({ theme: 'light' })
    ).toEqual({ theme: 'light' })
    expect(
      installationPreferencesSchema.safeParse({
        theme: 'light',
        partyQuickFields: ['invalid']
      }).success
    ).toBe(false)
    expect(
      installationPreferencesSchema.safeParse({
        theme: 'light',
        partyQuickFields: ['level', 'level']
      }).success
    ).toBe(false)
  })
  it('formats identity without redundant labels and keeps missing numbers explicit', () => {
    const member = {
      characterClass: 'Rogue',
      level: 4,
      species: 'Human',
      playerName: 'Anna',
      languages: ['Common'],
      movementSpeedFeet: 30,
      armorClass: null,
      passiveInvestigation: 15
    } as PartyCharacter
    expect(
      partyFieldValues(member, [
        'characterClass',
        'level',
        'species',
        'playerName'
      ])
    ).toEqual(['Rogue 4', 'Human', 'Anna'])
    expect(
      partyFieldValues(member, [
        'movementSpeedFeet',
        'armorClass',
        'passiveInvestigation'
      ])
    ).toEqual(['Speed 30 ft.', 'AC —', 'Inv. 15'])
    expect(
      partyFieldValues({ ...member, characterClass: null, species: null }, [
        'characterClass',
        'level',
        'species'
      ])
    ).toEqual(['Level 4'])
  })
  it('rejects invalid, foreign, dead, archived and resolution drops', () => {
    const group = {
      id: groupId,
      archived: false,
      entries: [{ aliveQuantity: 1 }]
    }
    const snapshot = {
      scene: {
        focusedSceneId: sceneId,
        scenes: [{ id: sceneId, groups: [group] }]
      },
      combat: null
    } as unknown as LiveSessionSnapshot
    const drag = { campaignId, sceneId, groupId }
    expect(droppableGroup(drag, campaignId, snapshot)?.id).toBe(groupId)
    expect(droppableGroup('bad', campaignId, snapshot)).toBeNull()
    expect(
      droppableGroup({ ...drag, campaignId: groupId }, campaignId, snapshot)
    ).toBeNull()
    expect(
      droppableGroup({ ...drag, sceneId: groupId }, campaignId, snapshot)
    ).toBeNull()
    expect(
      droppableGroup(drag, campaignId, {
        ...snapshot,
        combat: { phase: 'resolution' }
      } as LiveSessionSnapshot)
    ).toBeNull()
    group.archived = true
    expect(droppableGroup(drag, campaignId, snapshot)).toBeNull()
    group.archived = false
    group.entries[0]!.aliveQuantity = 0
    expect(droppableGroup(drag, campaignId, snapshot)).toBeNull()
  })
})
