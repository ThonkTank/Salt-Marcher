import { describe, expect, it } from 'vitest'
import type { EncounterTableSnapshot } from '../../src/shared/contracts/encounter-source.js'
import {
  encounterTables,
  mergeEncounterTableSnapshots
} from '../../src/renderer/features/encounter-table/encounter-table-snapshot.js'

const installationId = '01900000-0000-7000-8000-000000000201'
const campaignId = '01900000-0000-7000-8000-000000000202'

describe('mergeEncounterTableSnapshots', () => {
  it('keeps the newest independently revisioned data for every scope', () => {
    const known = snapshot(5, 3, 'Bekannte Installation', 'Neue Kampagne')
    const candidate = snapshot(6, 2, 'Neue Installation', 'Alte Kampagne')

    const merged = mergeEncounterTableSnapshots(known, candidate)
    expect(merged.installation.revision).toBe(6)
    expect(merged.campaign.revision).toBe(3)
    expect(encounterTables(merged)).toEqual([
      expect.objectContaining({
        id: installationId,
        displayName: 'Neue Installation'
      }),
      expect.objectContaining({
        id: campaignId,
        displayName: 'Neue Kampagne'
      })
    ])
  })

  it('does not let a delayed older snapshot replace a created table', () => {
    const created = snapshot(4, 7, 'Installation', 'Gerade erstellt')
    const delayed = snapshot(4, 6, 'Installation', 'Vorheriger Stand')

    expect(
      encounterTables(mergeEncounterTableSnapshots(created, delayed)).find(
        (table) => table.scope === 'campaign'
      )?.displayName
    ).toBe('Gerade erstellt')
  })
})

function snapshot(
  installationRevision: number,
  campaignRevision: number,
  installationName: string,
  campaignName: string
): EncounterTableSnapshot {
  return {
    installation: {
      revision: installationRevision,
      summaries: [],
      tables: [
        {
          id: installationId,
          scope: 'installation',
          protected: false,
          displayName: installationName,
          description: '',
          position: 0,
          entries: []
        }
      ]
    },
    campaign: {
      revision: campaignRevision,
      summaries: [],
      tables: [
        {
          id: campaignId,
          scope: 'campaign',
          protected: false,
          displayName: campaignName,
          description: '',
          position: 0,
          entries: []
        }
      ]
    }
  }
}
