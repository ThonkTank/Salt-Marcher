import { describe, expect, it } from 'vitest'
import {
  changeHpInputSchema,
  prepareCombatInputSchema,
  setExhaustionInputSchema,
  toggleConditionInputSchema
} from '../../src/shared/contracts/live-session.js'
import {
  evaluateSceneGroupDraftInputSchema,
  saveSceneGroupInputSchema,
  sceneGroupDraftGenerationRequestSchema
} from '../../src/shared/contracts/scene.js'
import {
  defaultSessionLayoutPreference,
  sessionLayoutPreferenceSchema
} from '../../src/shared/contracts/session-layout.js'
import {
  createWorldLocationInputSchema,
  updateWorldLocationInputSchema
} from '../../src/shared/contracts/world-location.js'
import {
  createEncounterTableInputSchema,
  createWorldFactionInputSchema
} from '../../src/shared/contracts/encounter-source.js'

describe('live session capability contracts', () => {
  it('allows empty named groups and rejects invalid quantities', () => {
    expect(
      saveSceneGroupInputSchema.safeParse({
        sceneId: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a030',
        groupId: null,
        name: 'Goblins',
        note: '',
        disposition: 'neutral',
        expectedRevision: 0,
        expectedGroupRevision: null,
        entries: []
      }).success
    ).toBe(true)
    expect(
      saveSceneGroupInputSchema.safeParse({
        sceneId: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a030',
        groupId: null,
        name: 'Goblins',
        note: '',
        disposition: 'hostile',
        expectedRevision: 0,
        expectedGroupRevision: null,
        entries: [{ creatureId: 'goblin', quantity: 0 }]
      }).success
    ).toBe(false)
    expect(
      prepareCombatInputSchema.safeParse({
        sceneId: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a030',
        expectedSceneRevision: 0,
        groupIds: ['0184d1f4-bba7-7c9c-9d89-5f1c0f36a031'],
        copiedStatblock: { hp: 7 }
      }).success
    ).toBe(false)
  })

  it('bounds HP commands and requires a displayed combat revision', () => {
    expect(
      changeHpInputSchema.safeParse({
        cardId: 'monster-card:1',
        amount: 4,
        healing: false,
        expectedRevision: 3
      }).success
    ).toBe(true)
    expect(
      changeHpInputSchema.safeParse({
        cardId: 'monster-card:1',
        amount: -1,
        healing: false,
        expectedRevision: 3
      }).success
    ).toBe(false)
  })

  it('keeps conditions language-neutral and models special statuses separately', () => {
    const base = {
      cardId: 'monster-card:1',
      active: true,
      expectedRevision: 3
    }
    expect(
      toggleConditionInputSchema.safeParse({ ...base, condition: 'prone' })
        .success
    ).toBe(true)
    expect(
      toggleConditionInputSchema.safeParse({
        ...base,
        condition: 'Concentration'
      }).success
    ).toBe(false)
    expect(
      setExhaustionInputSchema.safeParse({
        cardId: base.cardId,
        exhaustionLevel: 6,
        expectedRevision: base.expectedRevision
      }).success
    ).toBe(true)
  })

  it('validates transient draft evaluation and generation modes', () => {
    const base = {
      sceneId: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a030',
      expectedRevision: 2
    }
    expect(
      evaluateSceneGroupDraftInputSchema.safeParse({ ...base, entries: [] })
        .success
    ).toBe(true)
    expect(
      sceneGroupDraftGenerationRequestSchema.safeParse({
        ...base,
        entries: [{ creatureId: 'wolf', quantity: 2 }],
        mode: 'fill',
        filters: { types: ['Beast'] },
        tuning: {
          difficulty: 'medium',
          amount: 'standard',
          balance: 'even',
          diversity: 'high'
        },
        seed: 3
      }).success
    ).toBe(true)
    expect(
      sceneGroupDraftGenerationRequestSchema.safeParse({
        ...base,
        entries: [{ creatureId: 'wolf', quantity: 0 }],
        mode: 'append',
        filters: {},
        tuning: {},
        seed: 0
      }).success
    ).toBe(false)
  })

  it('retains both pane widths, the center tab and migrates old layouts', () => {
    expect(
      sessionLayoutPreferenceSchema.parse(defaultSessionLayoutPreference)
    ).toEqual(defaultSessionLayoutPreference)
    expect(
      sessionLayoutPreferenceSchema.safeParse({
        ...defaultSessionLayoutPreference,
        controlPaneWidth: 500
      }).success
    ).toBe(false)
    expect(
      sessionLayoutPreferenceSchema.parse({
        leftFraction: 0.62,
        rightTopFraction: 0.45,
        upperRightTab: 'map'
      })
    ).toEqual({
      controlPaneWidth: 300,
      scenarioPaneWidth: 264,
      centerTab: 'map'
    })
  })

  it('validates location drafts and revisioned updates', () => {
    expect(
      createWorldLocationInputSchema.safeParse({
        location: {
          displayName: 'Saltmarsh',
          tags: ['Hafen'],
          notes: 'Harbour town'
        },
        expectedRevision: 0
      }).success
    ).toBe(true)
    expect(
      updateWorldLocationInputSchema.safeParse({
        id: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a030',
        location: {
          displayName: ' ',
          tags: ['Ort'],
          notes: '',
          copiedMap: true
        },
        expectedRevision: 1
      }).success
    ).toBe(false)
  })

  it('validates weighted tables and bounded faction inventory', () => {
    expect(
      createEncounterTableInputSchema.safeParse({
        commandId: '00000000-0000-4000-8000-000000000001',
        expectedRevision: 0,
        table: {
          displayName: 'Harbour Patrol',
          description: '',
          entries: [{ creatureId: 'guard', weight: 10 }]
        }
      }).success
    ).toBe(true)
    expect(
      createEncounterTableInputSchema.safeParse({
        commandId: '00000000-0000-4000-8000-000000000002',
        expectedRevision: 0,
        table: {
          displayName: 'Broken',
          description: '',
          entries: [
            { creatureId: 'guard', weight: 11 },
            { creatureId: 'guard', weight: 1 }
          ]
        }
      }).success
    ).toBe(false)
    expect(
      createWorldFactionInputSchema.safeParse({
        expectedRevision: 2,
        faction: {
          displayName: 'Watch',
          notes: '',
          disposition: -51,
          primaryEncounterTableId: null,
          inventory: [{ creatureId: 'guard', maximum: 1 }]
        }
      }).success
    ).toBe(false)
  })
})
