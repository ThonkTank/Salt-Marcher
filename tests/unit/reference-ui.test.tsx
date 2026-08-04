// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type {
  ReferenceDocument,
  ReferenceIndex,
  ReferenceTarget
} from '../../src/shared/contracts/reference.js'
import { ReferenceProvider } from '../../src/renderer/features/reference/reference-provider.js'
import { ReferenceText } from '../../src/renderer/features/reference/reference-text.js'
import { useReferenceContext } from '../../src/renderer/features/reference/reference-context.js'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  }
)

const prone: ReferenceTarget = {
  scope: 'srd',
  catalogId: 'srd-5.1',
  definitionKind: 'condition',
  definitionId: 'conditions:prone'
}
const stunned: ReferenceTarget = {
  scope: 'srd',
  catalogId: 'srd-5.1',
  definitionKind: 'condition',
  definitionId: 'conditions:stunned'
}
const referenceIndex: ReferenceIndex = {
  scope: 'static',
  revision: 'one',
  terms: [
    ...[prone, stunned].map((target) => ({
      term: target === prone ? 'Prone' : 'Stunned',
      matchMode: 'folded' as const,
      candidates: [{ target, title: target === prone ? 'Prone' : 'Stunned' }]
    })),
    {
      term: 'Slow',
      matchMode: 'folded',
      candidates: [
        { target: prone, title: 'Prone' },
        { target: stunned, title: 'Stunned' }
      ]
    }
  ]
}

const document = (target: ReferenceTarget): ReferenceDocument => {
  const isProne =
    target === prone ||
    (target.scope === 'srd' && target.definitionId === 'conditions:prone')
  return {
    documentKind: 'article',
    target,
    title: isProne ? 'Prone' : 'Stunned',
    facts: [],
    blocks: [
      {
        kind: 'paragraph',
        inlines: isProne
          ? [
              { kind: 'text', text: 'A Prone creature can become ' },
              {
                kind: 'reference',
                text: 'Stunned',
                candidates: [{ target: stunned, title: 'Stunned' }]
              }
            ]
          : [{ kind: 'text', text: 'A Stunned creature cannot act.' }]
      }
    ],
    source: null
  }
}

function setup(text = 'Prone') {
  const activateReference = vi.fn()
  const capability: SaltMarcherApi['references'] = {
    staticIndex: vi.fn(() => Promise.resolve(referenceIndex)),
    campaignIndex: vi.fn(() =>
      Promise.resolve({
        scope: 'campaign',
        revision: 'campaign',
        terms: []
      } satisfies ReferenceIndex)
    ),
    detail: vi.fn((target: ReferenceTarget) =>
      Promise.resolve(document(target))
    ),
    onCampaignIndexChanged: vi.fn(() => () => undefined)
  }
  render(
    <ReferenceProvider
      capability={capability}
      campaignId="campaign"
      sceneId="scene"
      activateReference={activateReference}
      onError={vi.fn()}
    >
      <p>
        <ReferenceText>{text}</ReferenceText>
      </p>
      <NavigationProbe />
    </ReferenceProvider>
  )
  return { capability, activateReference }
}

function NavigationProbe() {
  const reference = useReferenceContext()
  return <output>{reference.navigation.document?.title ?? ''}</output>
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('reference UI', () => {
  it('opens a clicked term in the registered detail navigator', async () => {
    const { activateReference } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Prone' }))
    expect(activateReference).toHaveBeenCalledOnce()
    expect(
      await screen.findByText('Prone', { selector: 'output' })
    ).toBeInTheDocument()
  })

  it('renders compiler-linked concepts inside a focused preview', async () => {
    setup()
    fireEvent.focus(await screen.findByRole('button', { name: 'Prone' }))
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 350)))
    expect(
      await screen.findByRole('button', { name: 'Stunned' })
    ).toBeInTheDocument()
  })

  it('automatically pins after five seconds of direct dwell', async () => {
    vi.useFakeTimers()
    setup()
    await act(async () => Promise.resolve())
    const term = screen.getByRole('button', { name: 'Prone' })
    fireEvent.pointerEnter(term)
    await act(() => {
      vi.advanceTimersByTime(350)
      return Promise.resolve()
    })
    const card = screen.getByRole('region', { name: 'Referenz: Prone' })
    fireEvent.pointerEnter(card)
    await act(() => {
      vi.advanceTimersByTime(5_000)
      return Promise.resolve()
    })
    expect(
      screen.getByLabelText('Angeheftete Referenz: Prone')
    ).toBeInTheDocument()
  })

  it('keeps the card open across the 150ms corridor and closes on Escape', async () => {
    vi.useFakeTimers()
    setup()
    await act(async () => Promise.resolve())
    const term = screen.getByRole('button', { name: 'Prone' })
    fireEvent.pointerEnter(term)
    await act(() => {
      vi.advanceTimersByTime(350)
      return Promise.resolve()
    })
    const card = screen.getByRole('region', { name: 'Referenz: Prone' })
    fireEvent.pointerLeave(term)
    await act(() => {
      vi.advanceTimersByTime(149)
      return Promise.resolve()
    })
    expect(card).toBeInTheDocument()
    fireEvent.pointerEnter(card)
    await act(() => {
      vi.advanceTimersByTime(2)
      return Promise.resolve()
    })
    expect(card).toBeInTheDocument()
    fireEvent.keyDown(card, { key: 'Escape' })
    expect(
      screen.queryByRole('region', { name: 'Referenz: Prone' })
    ).not.toBeInTheDocument()
  })

  it('pins only the explicit selection from an ambiguous term', async () => {
    setup('Slow')
    const term = await screen.findByRole('button', { name: 'Slow' })
    fireEvent.click(term)
    const card = await screen.findByRole('region', { name: 'Referenz: Slow' })
    fireEvent.click(within(card).getByRole('button', { name: /Prone/ }))
    fireEvent.click(
      await within(card).findByRole('button', { name: 'Prone anheften' })
    )
    expect(
      await screen.findByLabelText('Angeheftete Referenz: Prone')
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Angeheftete Referenz: Stunned')
    ).not.toBeInTheDocument()
  })
})
