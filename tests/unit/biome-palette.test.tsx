// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BiomePalette } from '../../src/renderer/features/hex/biome-palette.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import type { BiomeDefinition } from '../../src/shared/contracts/biome.js'
import type { BiomeCatalogCapabilities } from '../../src/renderer/features/hex/biome-catalog-capabilities.js'

afterEach(cleanup)

const definitions: readonly BiomeDefinition[] = Array.from(
  { length: 100 },
  (_, index) =>
    ({
      id:
        index === 0
          ? 'grassland'
          : `01900000-0000-7000-8000-${String(index).padStart(12, '0')}`,
      kind: index === 0 ? 'builtin' : 'custom',
      displayName: index === 0 ? 'Grasland' : `Biom ${index}`,
      color: '#56734a',
      passable: true,
      travelCost: 1,
      position: index,
      protected: index === 0,
      aliases: index === 0 ? ['Grassland'] : [],
      encounterTableIds: []
    }) as BiomeDefinition
)

function fixture() {
  const search = vi.fn((query: string, offset: number, limit: number) => {
    void query
    return Promise.resolve({
      revision: 7,
      total: definitions.length,
      offset,
      limit,
      biomes: definitions.slice(offset, offset + limit)
    })
  })
  const create = vi.fn().mockResolvedValue({
    revision: 8,
    biome: definitions[1]
  })
  const capabilities = {
    biomes: {
      search,
      detail: vi.fn((id: string) =>
        Promise.resolve(definitions.find((biome) => biome.id === id)!)
      ),
      create,
      update: vi.fn(),
      deleteImpact: vi.fn(),
      delete: vi.fn(),
      onChanged: vi.fn().mockReturnValue(() => undefined)
    },
    encounterTables: {
      read: vi.fn().mockResolvedValue({
        revision: 0,
        installationRevision: 0,
        campaignRevision: 0,
        tables: []
      })
    }
  } as unknown as BiomeCatalogCapabilities
  return { capabilities, search, create }
}

function renderPalette(capabilities: BiomeCatalogCapabilities) {
  return render(
    <ModalLayerProvider>
      <BiomePalette
        capabilities={capabilities}
        selectedId="grassland"
        onSelect={vi.fn()}
        onError={vi.fn()}
      />
    </ModalLayerProvider>
  )
}

describe('BiomePalette', () => {
  it('mounts only the visible three-column window and pages from the server', async () => {
    const { capabilities, search } = fixture()
    const view = renderPalette(capabilities)
    expect(
      await screen.findByRole('button', { name: /Grasland/ })
    ).toBeVisible()
    expect(view.container.querySelectorAll('.hex-biome-tile')).toHaveLength(21)
    const viewport = view.container.querySelector('.hex-biome-viewport')!
    fireEvent.scroll(viewport, { target: { scrollTop: 1_280 } })
    await waitFor(() => expect(search).toHaveBeenCalledWith('', 60, 30))
    expect(
      view.container.querySelectorAll('.hex-biome-tile').length
    ).toBeLessThan(30)
  })

  it('creates a custom biome through the active catalog revision', async () => {
    const { capabilities, create } = fixture()
    renderPalette(capabilities)
    await screen.findByRole('button', { name: /Grasland/ })
    fireEvent.click(screen.getByRole('button', { name: 'Neu' }))
    expect(
      await screen.findByRole('dialog', { name: 'Biom erstellen' })
    ).toBeVisible()
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Kristallsteppe' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    expect(create.mock.calls[0]?.[1]).toMatchObject({
      displayName: 'Kristallsteppe',
      passable: true,
      travelCost: 1,
      encounterTableIds: []
    })
    expect(create.mock.calls[0]?.[2]).toBe(7)
  })
})
