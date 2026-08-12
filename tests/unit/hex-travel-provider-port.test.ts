import { describe, expect, it, vi } from 'vitest'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { HexCapabilities } from '../../src/renderer/features/hex/hex-capabilities.js'
import { createHexTravelProviderPort } from '../../src/renderer/features/hex/hex-travel-provider-port.js'

const sceneId = '01900000-0000-7000-8000-000000000080'
const mapId = '01900000-0000-7000-8000-000000000081'
const session = { scene: { focusedSceneId: sceneId } } as LiveSessionSnapshot
const travel = {
  revision: 4,
  sceneId,
  status: 'ready',
  mapId,
  mapName: 'Küste',
  current: { q: 0, r: 0 },
  currentLabel: 'Hex q=0, r=0',
  locationId: null,
  locationName: '',
  path: [],
  currentIndex: 0,
  segmentStartedAt: null,
  segmentEndsAt: null,
  progress: 1,
  remainingGameSeconds: 0,
  gameTimeSeconds: 0,
  effectiveSpeedFeet: 30,
  assumedSpeedMemberNames: [],
  multiplier: 1,
  hintCode: 'ready'
} as const

function fixture() {
  const result = { travel, session }
  const hexTravel = {
    read: vi.fn().mockResolvedValue(result),
    evaluate: vi.fn().mockResolvedValue({
      status: 'ready',
      path: [
        { q: 0, r: 0 },
        { q: 1, r: 0 }
      ],
      totalGameSeconds: 3600,
      totalTravelCost: 1,
      effectiveSpeedFeet: 30,
      assumedSpeedMemberNames: []
    }),
    position: vi.fn().mockResolvedValue(result),
    start: vi.fn().mockResolvedValue(result),
    pause: vi.fn().mockResolvedValue(result),
    resume: vi.fn().mockResolvedValue(result),
    abort: vi.fn().mockResolvedValue(result),
    setMultiplier: vi.fn().mockResolvedValue(result)
  }
  const sessionRead = vi.fn()
  const capabilities = {
    hex: {
      catalog: vi.fn().mockResolvedValue({
        revision: 1,
        maps: [
          {
            id: mapId,
            displayName: 'Küste',
            metadataRevision: 0,
            contentRevision: 1,
            position: 0
          }
        ]
      }),
      biomeCatalog: vi.fn().mockResolvedValue({ revision: 1, biomes: [] }),
      readChunks: vi.fn().mockResolvedValue({
        map: {
          id: mapId,
          displayName: 'Küste',
          metadataRevision: 0,
          contentRevision: 1,
          position: 0
        },
        chunks: [],
        biomes: []
      }),
      locateLocation: vi.fn(),
      runtimeOverlays: vi.fn().mockResolvedValue({ overlays: [] }),
      onChanged: vi.fn().mockReturnValue(() => undefined)
    },
    biomes: { onChanged: vi.fn().mockReturnValue(() => undefined) },
    session: {
      read: sessionRead,
      onChanged: vi.fn().mockReturnValue(() => undefined)
    },
    hexTravel
  } as unknown as HexCapabilities
  return { capabilities, hexTravel, sessionRead }
}

describe('Hex travel provider port', () => {
  it('bootstraps one consistent provider/session projection', async () => {
    const test = fixture()
    const port = createHexTravelProviderPort(test.capabilities)
    await expect(port.read({ sceneId })).resolves.toMatchObject({
      providerState: { travel },
      session
    })
    await expect(port.readMap({ mapId })).resolves.toMatchObject({
      map: { id: mapId }
    })
    expect(test.sessionRead).not.toHaveBeenCalled()
    port.dispose()
  })

  it('translates every generic command without a follow-up session read', async () => {
    const test = fixture()
    const port = createHexTravelProviderPort(test.capabilities)
    await port.read({ sceneId })
    await port.execute({
      kind: 'position',
      sceneId,
      mapId,
      position: { q: 1, r: 0 },
      expectedSceneRevision: 3
    })
    await port.execute({
      kind: 'start',
      sceneId,
      mapId,
      waypoints: [{ q: 2, r: 0 }],
      multiplier: 2,
      expectedRevision: 4
    })
    for (const kind of ['pause', 'resume', 'abort'] as const)
      await port.execute({ kind, sceneId, expectedRevision: 4 })
    await port.execute({
      kind: 'set-multiplier',
      sceneId,
      multiplier: 5,
      expectedRevision: 4
    })

    expect(test.hexTravel.position).toHaveBeenCalledWith({
      sceneId,
      mapId,
      coordinate: { q: 1, r: 0 },
      expectedSceneRevision: 3
    })
    expect(test.hexTravel.start).toHaveBeenCalledWith({
      sceneId,
      mapId,
      waypoints: [{ q: 2, r: 0 }],
      multiplier: 2,
      expectedRevision: 4
    })
    expect(test.hexTravel.pause).toHaveBeenCalledWith({
      sceneId,
      expectedRevision: 4
    })
    expect(test.hexTravel.resume).toHaveBeenCalledWith({
      sceneId,
      expectedRevision: 4
    })
    expect(test.hexTravel.abort).toHaveBeenCalledWith({
      sceneId,
      expectedRevision: 4
    })
    expect(test.hexTravel.setMultiplier).toHaveBeenCalledWith({
      sceneId,
      multiplier: 5,
      expectedRevision: 4
    })
    expect(test.sessionRead).not.toHaveBeenCalled()
    port.dispose()
  })
})
