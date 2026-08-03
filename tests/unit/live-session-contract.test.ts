import { describe, expect, it } from 'vitest'
import {
  changeHpInputSchema,
  prepareCombatInputSchema
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
  it('rejects empty groups, non-positive quantities and unknown fields', () => {
    expect(
      saveSceneGroupInputSchema.safeParse({
        sceneId: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a030',
        groupId: null,
        name: 'Goblins',
        expectedRevision: 0,
        entries: []
      }).success
    ).toBe(false)
    expect(
      saveSceneGroupInputSchema.safeParse({
        sceneId: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a030',
        groupId: null,
        name: 'Goblins',
        expectedRevision: 0,
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

  it('retains the two independent divider positions and bounds them', () => {
    expect(
      sessionLayoutPreferenceSchema.parse(defaultSessionLayoutPreference)
    ).toEqual(defaultSessionLayoutPreference)
    expect(
      sessionLayoutPreferenceSchema.safeParse({
        ...defaultSessionLayoutPreference,
        leftFraction: 0.95
      }).success
    ).toBe(false)
  })

  it('validates location drafts and revisioned updates', () => {
    expect(
      createWorldLocationInputSchema.safeParse({
        location: { displayName: 'Saltmarsh', notes: 'Harbour town' },
        expectedRevision: 0
      }).success
    ).toBe(true)
    expect(
      updateWorldLocationInputSchema.safeParse({
        id: '0184d1f4-bba7-7c9c-9d89-5f1c0f36a030',
        location: { displayName: ' ', notes: '', copiedMap: true },
        expectedRevision: 1
      }).success
    ).toBe(false)
  })

  it('validates weighted tables and bounded faction inventory', () => {
    expect(
      createEncounterTableInputSchema.safeParse({
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
