import { describe, expect, it } from 'vitest'
import {
  campaignHexTravelCommandSchema,
  hexRoutePlanSnapshotSchema,
  hexTravelCommandSchema
} from '../../src/shared/contracts/hex-travel-command.js'

const sceneId = '11111111-1111-4111-8111-111111111111'
const mapId = '22222222-2222-4222-8222-222222222222'
const commandId = '33333333-3333-4333-8333-333333333333'
const campaignId = '44444444-4444-4444-8444-444444444444'
const plan = { mapId, waypoints: [{ q: 1, r: 2 }], multiplier: 2 }
const save = {
  commandId,
  command: {
    kind: 'save-plan',
    input: { sceneId, expectedPlanRevision: 4, expectedSceneRevision: 9, plan }
  }
}

describe('Hex travel command boundary', () => {
  it('saves and explicitly clears a plan without a journey revision or start action', () => {
    expect(hexTravelCommandSchema.parse(save)).toEqual(save)
    const clear = {
      ...save,
      command: { ...save.command, input: { ...save.command.input, plan: null } }
    }
    expect(hexTravelCommandSchema.parse(clear)).toEqual(clear)
    expect(
      hexRoutePlanSnapshotSchema.parse({ sceneId, revision: 5, plan: null })
    ).toEqual({ sceneId, revision: 5, plan: null })
  })

  it('requires original campaign identity at the utility boundary', () => {
    expect(campaignHexTravelCommandSchema.safeParse(save).success).toBe(false)
    expect(
      campaignHexTravelCommandSchema.parse({ ...save, campaignId })
    ).toEqual({ ...save, campaignId })
    expect(
      campaignHexTravelCommandSchema.safeParse({
        ...save,
        campaignId: '../other'
      }).success
    ).toBe(false)
  })

  it('does not accept journey CAS in place of plan CAS', () => {
    const input = { sceneId, expectedSceneRevision: 9, plan }
    expect(
      hexTravelCommandSchema.safeParse({
        ...save,
        command: { kind: 'save-plan', input: { ...input, expectedRevision: 4 } }
      }).success
    ).toBe(false)
    expect(
      hexTravelCommandSchema.safeParse({
        ...save,
        command: { kind: 'start', input: save.command.input }
      }).success
    ).toBe(false)
  })

  it.each([
    { ...plan, waypoints: [] },
    { ...plan, waypoints: Array.from({ length: 201 }, () => ({ q: 0, r: 0 })) },
    { ...plan, multiplier: 3 },
    { ...plan, waypoints: [{ q: 0.5, r: 0 }] },
    { ...plan, status: 'travelling' }
  ])('rejects malformed or executable plan data %#', (invalidPlan) => {
    expect(
      hexTravelCommandSchema.safeParse({
        ...save,
        command: {
          ...save.command,
          input: { ...save.command.input, plan: invalidPlan }
        }
      }).success
    ).toBe(false)
  })

  it.each(['pause', 'resume', 'abort'])(
    'keeps %s an explicit revision-bound action',
    (kind) => {
      const action = {
        commandId,
        command: {
          kind,
          input: { sceneId, expectedRevision: 3, expectedSceneRevision: 9 }
        }
      }
      expect(hexTravelCommandSchema.parse(action)).toEqual(action)
    }
  )

  it('preserves the existing start, position and active multiplier payloads', () => {
    for (const command of [
      {
        kind: 'start',
        input: {
          sceneId,
          ...plan,
          expectedRevision: 3,
          expectedSceneRevision: 9
        }
      },
      {
        kind: 'position',
        input: {
          sceneId,
          mapId,
          coordinate: { q: 1, r: 2 },
          expectedSceneRevision: 9
        }
      },
      {
        kind: 'set-multiplier',
        input: {
          sceneId,
          multiplier: 5,
          expectedRevision: 3,
          expectedSceneRevision: 9
        }
      }
    ])
      expect(hexTravelCommandSchema.parse({ commandId, command })).toEqual({
        commandId,
        command
      })
  })
})
