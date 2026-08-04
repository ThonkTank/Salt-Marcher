// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type {
  ReferenceDocument,
  ReferenceIndex,
  ReferenceTarget
} from '../../src/shared/contracts/reference.js'
import { ReferenceProvider } from '../../src/renderer/features/reference/reference-provider.js'
import { ReferenceText } from '../../src/renderer/features/reference/reference-ui.js'

const referenceIndex: ReferenceIndex = {
  revision: 'one',
  terms: [
    {
      term: 'Prone',
      matchMode: 'folded',
      candidates: [
        {
          target: { kind: 'condition', id: 'conditions:prone' },
          title: 'Prone',
          context: 'Conditions'
        }
      ]
    },
    {
      term: 'Stunned',
      matchMode: 'folded',
      candidates: [
        {
          target: { kind: 'condition', id: 'conditions:stunned' },
          title: 'Stunned',
          context: 'Conditions'
        }
      ]
    }
  ]
}

const document = (target: ReferenceTarget): ReferenceDocument => ({
  target,
  title: target.id.endsWith('prone') ? 'Prone' : 'Stunned',
  context: 'Conditions',
  summary: target.id.endsWith('prone')
    ? 'A Prone creature can also become Stunned.'
    : 'A Stunned creature cannot act.',
  facts: [],
  sections: [],
  source: null
})

function setup() {
  const openReference = vi.fn()
  const capability: SaltMarcherApi['references'] = {
    index: vi.fn(() => Promise.resolve(referenceIndex)),
    detail: vi.fn((target: ReferenceTarget) =>
      Promise.resolve(document(target))
    )
  }
  render(
    <ReferenceProvider
      capability={capability}
      campaignId="0184d1f4-bba7-7c9c-9d89-5f1c0f36a031"
      refreshKey="session"
      openReference={openReference}
      onError={vi.fn()}
    >
      <p>
        <ReferenceText>Prone</ReferenceText>
      </p>
    </ReferenceProvider>
  )
  return { capability, openReference }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('reference UI', () => {
  it('opens a clicked term in the registered detail navigator', async () => {
    const { openReference } = setup()
    const term = await screen.findByRole('button', { name: 'Prone' })
    fireEvent.click(term)
    expect(openReference).toHaveBeenCalledWith(
      { kind: 'condition', id: 'conditions:prone' },
      'Conditions › Prone'
    )
  })

  it('renders recursively linked concepts inside a focused preview', async () => {
    setup()
    const term = await screen.findByRole('button', { name: 'Prone' })
    fireEvent.focus(term)
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
      vi.advanceTimersByTime(5_000)
      return Promise.resolve()
    })
    expect(
      screen.getByLabelText('Angeheftete Referenz: Prone')
    ).toBeInTheDocument()
  })
})
