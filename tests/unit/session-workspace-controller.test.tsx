// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { maintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import { ReferenceContext } from '../../src/renderer/features/reference/reference-context.js'
import { useSessionWorkspaceController } from '../../src/renderer/features/session/use-session-workspace-controller.js'
import type { ReferenceContextValue } from '../../src/renderer/features/reference/reference-context.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'

const sceneId = '01900000-0000-7000-8000-000000000201'
const groupId = '01900000-0000-7000-8000-000000000202'
const memberId = '01900000-0000-7000-8000-000000000203'

describe('session workspace controller', () => {
  it('projects discriminated rows and owns expansion and revisioned commands', async () => {
    const initial = snapshot(4)
    const updated = snapshot(5)
    const setSnapshot = vi.fn()
    const onError = vi.fn()
    const setLocation = vi.fn().mockResolvedValue(updated)
    const api = sessionApi({ setLocation })
    let current = initial
    const wrapper = controllerWrapper(api, () => current)
    const view = renderHook(
      ({ value }: { value: LiveSessionSnapshot }) =>
        useSessionWorkspaceController({
          campaignId: 'campaign',
          snapshot: value,
          setSnapshot,
          onError
        }),
      { wrapper, initialProps: { value: initial } }
    )
    await waitFor(() => expect(api.loot.scene).toHaveBeenCalled())
    expect(
      view.result.current.model.groups.activeRows.map((row) => row.kind)
    ).toEqual(['active-group'])
    expect(view.result.current.model.groups.activeRows[0]).toMatchObject({
      kind: 'active-group',
      sceneId,
      expanded: true
    })

    act(() => view.result.current.actions.manageGroups())
    expect(view.result.current.model.dialog).toEqual({
      kind: 'group-editor',
      group: null,
      reinforcement: false
    })
    act(() => view.result.current.actions.closeDialog())
    expect(view.result.current.model.dialog).toEqual({ kind: 'none' })

    act(() => view.result.current.actions.toggleRow({ kind: 'group', groupId }))
    expect(view.result.current.model.groups.activeRows[0]).toMatchObject({
      kind: 'active-group',
      expanded: false
    })

    current = updated
    view.rerender({ value: updated })
    act(() => view.result.current.actions.setSceneLocation(null))
    await waitFor(() =>
      expect(setLocation).toHaveBeenCalledWith({
        sceneId,
        locationId: null,
        expectedRevision: updated.scene.revision
      })
    )
    await waitFor(() => expect(setSnapshot).toHaveBeenCalledWith(updated))
  })

  it('routes command failures through the controller error boundary', async () => {
    const value = snapshot(3, true)
    const failure = new Error('restore failed')
    const executeGroupLifecycle = vi.fn().mockRejectedValue(failure)
    const onError = vi.fn()
    const setSnapshot = vi.fn()
    const api = sessionApi({
      executeGroupLifecycle,
      groupLifecycleStatus: vi.fn().mockResolvedValue({
        receipt: { scenePatch: {}, combat: null },
        snapshot: value
      })
    })
    const view = renderHook(
      () =>
        useSessionWorkspaceController({
          campaignId: 'campaign',
          snapshot: value,
          setSnapshot,
          onError
        }),
      { wrapper: controllerWrapper(api, () => value) }
    )
    const row = view.result.current.model.groups.archivedRows[0]
    expect(row?.kind).toBe('archived-group')
    act(() => {
      if (row?.kind === 'archived-group')
        view.result.current.actions.restoreGroup(row.group)
    })
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.any(String))
    )
    expect(executeGroupLifecycle).toHaveBeenCalledOnce()
    const resolution = maintenanceDraftCoordinator.begin()
    await act(async () => {
      expect(await resolution.resolve('discard')).toEqual([])
    })
    resolution.release()
  })
})

function snapshot(revision: number, archived = false): LiveSessionSnapshot {
  return {
    revision,
    party: {
      revision,
      members: [{ id: memberId, name: 'Alrik', active: true, level: 3 }]
    },
    scene: {
      revision,
      focusedSceneId: sceneId,
      scenes: [
        {
          id: sceneId,
          title: 'Kai',
          locationId: null,
          locationName: '',
          partyMemberIds: [memberId],
          groups: [
            {
              id: groupId,
              revision: 7,
              position: 0,
              name: 'Schmuggler',
              note: '',
              disposition: 'hostile',
              archived,
              entries: [],
              baseXp: 0
            }
          ]
        }
      ]
    },
    combat: null
  } as unknown as LiveSessionSnapshot
}

function sessionApi(sceneOverrides: Record<string, unknown>): SaltMarcherApi {
  return {
    session: { onChanged: vi.fn(() => () => undefined) },
    loot: {
      scene: vi.fn().mockResolvedValue({
        revision: 0,
        sceneId,
        locationId: null,
        locationTreasures: [],
        groupTreasures: []
      }),
      inbox: vi
        .fn()
        .mockResolvedValue({ revision: 0, entries: [], nextCursor: null }),
      onChanged: vi.fn().mockReturnValue(() => undefined)
    },
    scene: {
      assignPartyMember: vi.fn(),
      setGroupArchived: vi.fn(),
      deleteGroup: vi.fn(),
      ...sceneOverrides
    }
  } as unknown as SaltMarcherApi
}

function controllerWrapper(
  api: SaltMarcherApi,
  session: () => LiveSessionSnapshot
) {
  const root = () => ({
    sessionCampaignId: 'campaign',
    campaigns: { activeCampaignId: 'campaign' },
    session: session()
  })
  const context = {
    api,
    campaignWorkspace: {
      snapshot: root,
      subscribe: () => () => {},
      refreshActiveSession: () =>
        Promise.resolve({ status: 'ready', value: root() })
    }
  } as unknown as CapabilityContextValue
  const reference = {
    openReference: vi.fn(),
    navigation: { entries: [], index: -1, document: null, loading: false }
  } as unknown as ReferenceContextValue
  return function Wrapper(props: { children: ReactNode }) {
    return (
      <CapabilityContext.Provider value={context}>
        <ReferenceContext.Provider value={reference}>
          {props.children}
        </ReferenceContext.Provider>
      </CapabilityContext.Provider>
    )
  }
}
