// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IntegratedWorldLocationEditor } from '../../src/renderer/features/workspace/integrations/integrated-world-location-editor.js'
import type { HexMapProjectionPort } from '../../src/renderer/features/hex/hex-map-projection-port.js'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'

describe('IntegratedWorldLocationEditor', () => {
  it('keeps base location saving available when map projection fails', async () => {
    const save = vi.fn().mockResolvedValue({ status: 'saved' })
    const port: HexMapProjectionPort = {
      cacheLifetime: 'transient',
      currentCatalog: () => null,
      currentBiomeCatalog: () => null,
      readCatalog: vi.fn().mockRejectedValue(new Error('maps offline')),
      readBiomeCatalog: vi.fn().mockResolvedValue({ revision: 0, biomes: [] }),
      locateLocation: vi.fn().mockResolvedValue(null),
      readMap: vi.fn().mockRejectedValue(new Error('maps offline')),
      subscribe: vi.fn().mockReturnValue(() => undefined),
      dispose: vi.fn()
    }
    render(
      <ModalLayerProvider>
        <IntegratedWorldLocationEditor
          location={null}
          references={{
            factions: { status: 'ready', value: [] },
            tables: { status: 'ready', value: [] }
          }}
          close={vi.fn()}
          onError={vi.fn()}
          save={save}
          port={port}
          mapCreation={{ createMap: vi.fn() }}
          suggestTags={() => Promise.resolve([])}
          failureText={(failure) => failure.kind}
        />
      </ModalLayerProvider>
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unbekannter Fehler'
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Ortsname' }), {
      target: { value: 'Kartenloses Kap' }
    })
    const tags = screen.getByRole('combobox', { name: 'Tags' })
    fireEvent.change(tags, { target: { value: 'Küste' } })
    fireEvent.keyDown(tags, { key: 'Enter' })
    const create = screen.getByRole('button', { name: 'Erstellen' })
    expect(create).toBeEnabled()
    fireEvent.click(create)
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Kartenloses Kap',
          tags: ['Küste']
        }),
        { kind: 'keep' }
      )
    )
  })
})
