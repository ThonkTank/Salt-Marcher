import { expect, it, vi } from 'vitest'
import { prepareTravelCommand } from '../../src/renderer/features/travel/prepare-travel-command.js'
import type {
  TravelProviderCommand,
  TravelProviderDescriptor,
  TravelProviderPort
} from '../../src/renderer/features/travel/travel-provider-port.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'

type Position = { q: number; r: number }
type State = TravelProviderDescriptor<Position>
function fixture(status = 'travelling') {
  const descriptor: State = {
    revision: 11,
    status,
    currentMapId: 'map',
    currentPosition: { q: 0, r: 0 },
    multiplier: 2,
    mapOptions: [{ id: 'map', label: 'Map' }],
    routePlan: {
      sceneId: 'scene',
      revision: 7,
      plan: { mapId: 'map', waypoints: [{ q: 5, r: 0 }], multiplier: 5 }
    }
  }
  const result = {
    providerState: descriptor,
    session: {
      scene: { focusedSceneId: 'scene', revision: 8 }
    } as unknown as LiveSessionSnapshot
  }
  type Port = TravelProviderPort<
    Position,
    State,
    { valid: boolean },
    { ready: boolean }
  >
  const port: Port = {
    kind: 'hex',
    read: vi.fn<Port['read']>().mockResolvedValue(result),
    describe: (value) => value,
    readMap: vi.fn<Port['readMap']>().mockResolvedValue({ valid: true }),
    isAuthoredPosition: (map) => map.valid,
    evaluate: vi.fn<Port['evaluate']>().mockResolvedValue({ ready: true }),
    canStart: (evaluation) => evaluation.ready,
    execute: vi.fn(),
    subscribe: () => () => undefined,
    dispose: () => undefined
  }
  return { port, result, descriptor }
}
const start: TravelProviderCommand<Position> = {
  kind: 'start',
  sceneId: 'scene',
  expectedSceneRevision: 1,
  expectedRevision: 2,
  mapId: 'map',
  waypoints: [{ q: 1, r: 0 }],
  multiplier: 1
}

it.each([
  ['pause', 'paused'],
  ['pause', 'completed'],
  ['resume', 'travelling'],
  ['resume', 'aborted'],
  ['abort', 'aborted']
] as const)(
  'does not reinterpret %s when the resolved state is %s',
  async (kind, status) => {
    const f = fixture(status)
    const prepared = await prepareTravelCommand({
      port: f.port,
      command: {
        kind,
        sceneId: 'scene',
        expectedSceneRevision: 1,
        expectedRevision: 2
      }
    })
    expect(prepared.command).toBeNull()
    expect(prepared.result).toEqual(f.result)
    expect(f.port.execute).not.toHaveBeenCalled()
  }
)
it.each([
  ['pause', 'travelling'],
  ['resume', 'paused'],
  ['abort', 'blocked']
] as const)('prepares %s with fresh revisions', async (kind, status) => {
  const f = fixture(status)
  expect(
    (
      await prepareTravelCommand({
        port: f.port,
        command: {
          kind,
          sceneId: 'scene',
          expectedSceneRevision: 1,
          expectedRevision: 2
        }
      })
    ).command
  ).toEqual({
    kind,
    sceneId: 'scene',
    expectedSceneRevision: 8,
    expectedRevision: 11
  })
})
it('uses the resolved saved route rather than captured pre-dialog waypoints', async () => {
  const f = fixture('ready')
  const route = { plan: f.descriptor.routePlan.plan, savedRevision: 7 }
  const prepared = await prepareTravelCommand({
    port: f.port,
    command: start,
    route
  })
  expect(prepared.command).toEqual({
    ...start,
    expectedSceneRevision: 8,
    expectedRevision: 11,
    waypoints: [{ q: 5, r: 0 }],
    multiplier: 5
  })
  expect(f.port.evaluate).toHaveBeenCalledExactlyOnceWith({
    sceneId: 'scene',
    mapId: 'map',
    waypoints: [{ q: 5, r: 0 }]
  })
  expect(f.port.execute).not.toHaveBeenCalled()
})
it.each([
  null,
  { mapId: 'other-map', waypoints: [{ q: 5, r: 0 }], multiplier: 1 as const }
])('does not start discarded or differently mapped plans', async (plan) => {
  const f = fixture('ready')
  expect(
    (
      await prepareTravelCommand({
        port: f.port,
        command: start,
        route: { plan, savedRevision: 7 }
      })
    ).command
  ).toBeNull()
  expect(f.port.evaluate).not.toHaveBeenCalled()
})
it('refuses a newer route basis and rejected evaluation', async () => {
  const f = fixture('ready')
  await expect(
    prepareTravelCommand({
      port: f.port,
      command: start,
      route: { plan: f.descriptor.routePlan.plan, savedRevision: 6 }
    })
  ).rejects.toMatchObject({ code: 'stale' })
  vi.mocked(f.port.evaluate).mockResolvedValue({ ready: false })
  await expect(
    prepareTravelCommand({
      port: f.port,
      command: start,
      route: { plan: f.descriptor.routePlan.plan, savedRevision: 7 }
    })
  ).rejects.toMatchObject({ code: 'validation_failed' })
  expect(f.port.execute).not.toHaveBeenCalled()
})
it('applies the relative speed intent to the fresh multiplier', async () => {
  const f = fixture()
  const command: TravelProviderCommand<Position> = {
    kind: 'set-multiplier',
    sceneId: 'scene',
    expectedSceneRevision: 1,
    expectedRevision: 2,
    multiplier: 2
  }
  expect(
    (
      await prepareTravelCommand({
        port: f.port,
        command,
        multiplierDirection: 1
      })
    ).command
  ).toEqual({
    ...command,
    expectedSceneRevision: 8,
    expectedRevision: 11,
    multiplier: 5
  })
})
it('checks position against a fresh map and refuses a foreign scene', async () => {
  const f = fixture()
  const command: TravelProviderCommand<Position> = {
    kind: 'position',
    sceneId: 'scene',
    expectedSceneRevision: 1,
    mapId: 'map',
    position: { q: 3, r: 1 }
  }
  expect(
    (await prepareTravelCommand({ port: f.port, command })).command
  ).toEqual({ ...command, expectedSceneRevision: 8 })
  expect(f.port.readMap).toHaveBeenCalledWith({ mapId: 'map', force: true })
  vi.mocked(f.port.readMap).mockResolvedValue({ valid: false })
  await expect(
    prepareTravelCommand({ port: f.port, command })
  ).rejects.toMatchObject({ code: 'validation_failed' })
  vi.mocked(f.port.read).mockResolvedValue({
    ...f.result,
    session: {
      scene: { focusedSceneId: 'another', revision: 9 }
    } as unknown as LiveSessionSnapshot
  })
  await expect(
    prepareTravelCommand({ port: f.port, command })
  ).rejects.toMatchObject({ code: 'stale' })
})
