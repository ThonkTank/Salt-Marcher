// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render as testingRender,
  screen
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EncounterTableSummary } from '../../src/shared/contracts/encounter-source.js'
import { FactionTablePicker } from '../../src/renderer/features/worldplanner/faction-table-picker.js'
import { ModalDialog } from '../../src/renderer/shell/modal-dialog.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

const render = (ui: Parameters<typeof testingRender>[0]) =>
  testingRender(ui, { wrapper: ModalLayerProvider })

const coastId = '01900000-0000-7000-8000-000000000211'
const forestId = '01900000-0000-7000-8000-000000000212'
const missingId = '01900000-0000-7000-8000-000000000213'
const summaries: readonly EncounterTableSummary[] = [
  summary(coastId, 'Küstenwache', 2, ['Küste'], ['1/4', '5']),
  summary(forestId, 'Waldpatrouille', 1, ['Wald'], ['3', '3']),
  summary(missingId, 'Unbekannte Spuren', 1, [], null)
]

afterEach(cleanup)

describe('FactionTablePicker', () => {
  it('searches normalized names and shows entry count and CR span', () => {
    renderPicker()
    openPicker()
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Nach Name suchen …' }),
      { target: { value: 'kusten' } }
    )

    expect(
      screen.getByRole('option', {
        name: /Küstenwache.*2 Einträge · CR 1\/4–5/
      })
    ).toBeVisible()
    expect(
      screen.queryByRole('option', { name: /Waldpatrouille/ })
    ).not.toBeInTheDocument()
  })

  it('filters by monster environment and keeps missing facts as CR —', () => {
    renderPicker()
    openPicker()
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Umgebung filtern' }),
      { target: { value: 'Wald' } }
    )

    expect(screen.getByRole('option', { name: /Waldpatrouille/ })).toBeVisible()
    expect(
      screen.queryByRole('option', { name: /Küstenwache/ })
    ).not.toBeInTheDocument()

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Umgebung filtern' }),
      { target: { value: '' } }
    )
    expect(
      screen.getByRole('option', {
        name: /Unbekannte Spuren.*1 Einträge · CR —/
      })
    ).toBeVisible()
  })

  it('consumes Escape before its owning modal and restores anchor focus', () => {
    const close = vi.fn()
    render(
      <ModalLayerProvider>
        <ModalDialog className="faction" ariaLabel="Fraktion" onClose={close}>
          <FactionTablePicker
            summaries={summaries}
            value={null}
            disabled={false}
            changed={vi.fn()}
            createTable={vi.fn()}
          />
        </ModalDialog>
      </ModalLayerProvider>
    )
    const anchor = screen.getByRole('button', {
      name: /Keine primäre Tabelle/
    })
    fireEvent.click(anchor)
    expect(screen.getByRole('listbox')).toBeVisible()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(close).not.toHaveBeenCalled()
    expect(anchor).toHaveFocus()
  })
})

function renderPicker() {
  render(
    <section role="dialog" aria-label="Fraktion">
      <FactionTablePicker
        summaries={summaries}
        value={null}
        disabled={false}
        changed={vi.fn()}
        createTable={vi.fn()}
      />
    </section>
  )
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: /Keine primäre Tabelle/ }))
}

function summary(
  id: string,
  displayName: string,
  entryCount: number,
  biomes: readonly string[],
  range: readonly [string, string] | null
): EncounterTableSummary {
  return {
    id,
    scope: 'campaign',
    displayName,
    entryCount,
    challengeRatingRange: range
      ? { minimum: range[0], maximum: range[1] }
      : null,
    biomes: [...biomes]
  }
}
