// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopReader } from '../../src/renderer/features/scene-desktop/desktop-references.js'
import { ReferenceProvider } from '../../src/renderer/features/reference/reference-provider.js'
import { useReferenceContext } from '../../src/renderer/features/reference/reference-context.js'
import { initialOverviewWindow } from '../../src/renderer/features/scene-desktop/desktop-state.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type {
  ReferenceDocument,
  ReferenceTarget
} from '../../src/shared/contracts/reference.js'
import type { SceneDesktopWindow } from '../../src/shared/contracts/scene-desktop.js'
const first: ReferenceTarget = {
  scope: 'srd',
  catalogId: 'srd-5.1',
  definitionKind: 'item',
  definitionId: 'one'
}
const second: ReferenceTarget = { ...first, definitionId: 'two' }
const doc = (target: ReferenceTarget, text: string): ReferenceDocument => ({
  documentKind: 'article',
  target,
  title: text,
  facts: [],
  blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text }] }],
  source: null
})
const entries = [
  { target: first, title: 'One', scrollTop: 215 },
  { target: second, title: 'Two', scrollTop: 91 }
]
const reader = (index: number): SceneDesktopWindow => ({
  ...initialOverviewWindow,
  kind: 'reader',
  id: 'reader',
  entries,
  index
})
function api(
  detail: SaltMarcherApi['references']['detail']
): SaltMarcherApi['references'] {
  return {
    detail,
    staticIndex: vi.fn().mockResolvedValue({
      scope: 'static',
      revision: '1',
      terms: [
        {
          term: 'One',
          matchMode: 'folded',
          candidates: [{ target: first, title: 'One' }]
        }
      ]
    }),
    campaignIndex: vi
      .fn()
      .mockResolvedValue({ scope: 'campaign', revision: '1', terms: [] }),
    onCampaignIndexChanged: () => () => {}
  }
}
afterEach(cleanup)
describe('desktop reader rendering', () => {
  it('ignores a late response and restores each history entry after its content loads', async () => {
    let resolveFirst!: (document: ReferenceDocument) => void
    const pending = new Promise<ReferenceDocument>((resolve) => {
      resolveFirst = resolve
    })
    const capability = api(
      vi.fn((target) =>
        target === first ? pending : Promise.resolve(doc(second, 'Second body'))
      )
    )
    const dispatch = vi.fn()
    const content = (index: number) => (
      <ReferenceProvider
        capability={capability}
        campaignId="campaign"
        sceneId="scene"
        routeReference={vi.fn()}
        onError={vi.fn()}
      >
        <DesktopReader window={reader(index)} dispatch={dispatch} />
      </ReferenceProvider>
    )
    const view = render(content(0))
    view.rerender(content(1))
    await screen.findByText('Second body')
    const scroll = view.container.querySelector('.desktop-reference-scroll')!
    expect(scroll.scrollTop).toBe(91)
    await act(async () => {
      resolveFirst(doc(first, 'First body'))
      await pending
    })
    expect(screen.queryByText('First body')).not.toBeInTheDocument()
    view.rerender(content(0))
    await screen.findByText('First body')
    expect(
      view.container.querySelector('.desktop-reference-scroll')!.scrollTop
    ).toBe(215)
    expect(screen.queryByText('Second body')).not.toBeInTheDocument()
  })
  it('keeps a missing saved reference explicit and retries without discarding history', async () => {
    const detail = vi
      .fn()
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce(doc(first, 'Recovered body'))
    const dispatch = vi.fn()
    render(
      <ReferenceProvider
        capability={api(detail)}
        campaignId="campaign"
        sceneId="scene"
        routeReference={vi.fn()}
        onError={vi.fn()}
      >
        <DesktopReader window={reader(0)} dispatch={dispatch} />
      </ReferenceProvider>
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Referenz nicht verfügbar.'
    )
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }))
    expect(await screen.findByText('Recovered body')).toBeVisible()
    expect(detail).toHaveBeenCalledTimes(2)
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'close' })
    )
    expect(screen.getByRole('button', { name: 'Vorwärts' })).toBeEnabled()
  })
  it('routes ordinary links and pin actions to desktop windows without activating legacy navigation', async () => {
    const route = vi.fn()
    function Probe() {
      const context = useReferenceContext()
      return (
        <>
          <button onClick={() => context.openReference(first, 'One')}>
            Open
          </button>
          <button
            disabled={!context.compiled}
            onClick={() => context.openSeparateReference(first)}
          >
            Separate
          </button>
        </>
      )
    }
    render(
      <ReferenceProvider
        capability={api(vi.fn().mockResolvedValue(doc(first, 'body')))}
        campaignId="campaign"
        sceneId="scene"
        onError={vi.fn()}
        routeReference={route}
      >
        <Probe />
      </ReferenceProvider>
    )
    await act(async () => {})
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Separate'))
    expect(route.mock.calls).toEqual([
      [first, 'One', false],
      [first, 'One', true]
    ])
  })
})
