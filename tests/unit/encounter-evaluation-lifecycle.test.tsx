// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useEncounterEvaluation } from '../../src/renderer/features/encounter/use-encounter-evaluation.js'
import type { EncounterSelectionEvaluation } from '../../src/shared/contracts/scene.js'

const mocks = vi.hoisted(() => ({ evaluate: vi.fn(), api: {} }))
vi.mock('../../src/renderer/capabilities/use-capability-api.js', () => ({
  useCapabilityApi: () => mocks.api
}))
vi.mock(
  '../../src/renderer/features/encounter/encounter-capabilities.js',
  () => ({
    encounterCapabilities: () => ({ encounter: { evaluate: mocks.evaluate } })
  })
)
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const groups = ['group']

it('does not evaluate an active combat and resumes selection using the current revision', async () => {
  const result = { canStart: true } as EncounterSelectionEvaluation
  mocks.evaluate.mockResolvedValue(result)
  const onError = vi.fn()
  const view = renderHook(
    ({ enabled, revision }) =>
      useEncounterEvaluation('scene', groups, revision, onError, enabled),
    { initialProps: { enabled: false, revision: 7 } }
  )
  expect(mocks.evaluate).not.toHaveBeenCalled()
  expect(view.result.current).toBeNull()
  view.rerender({ enabled: true, revision: 11 })
  await waitFor(() => expect(view.result.current).toEqual(result))
  expect(mocks.evaluate).toHaveBeenCalledExactlyOnceWith({
    sceneId: 'scene',
    groupIds: groups,
    expectedRevision: 11
  })
  view.rerender({ enabled: false, revision: 12 })
  expect(view.result.current).toBeNull()
  expect(mocks.evaluate).toHaveBeenCalledOnce()
})

it('ignores a pending selection failure after a combat command disables evaluation', async () => {
  let reject!: (cause: Error) => void
  mocks.evaluate.mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail
    })
  )
  const onError = vi.fn()
  const view = renderHook(
    ({ enabled }) =>
      useEncounterEvaluation('scene', groups, 7, onError, enabled),
    { initialProps: { enabled: true } }
  )
  expect(mocks.evaluate).toHaveBeenCalledOnce()
  view.rerender({ enabled: false })
  await act(async () => {
    reject(new Error('stale'))
    await Promise.resolve()
  })
  expect(onError).not.toHaveBeenCalled()
  expect(view.result.current).toBeNull()
})
