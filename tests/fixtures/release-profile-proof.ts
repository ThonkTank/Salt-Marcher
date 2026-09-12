export function profileProofFixture() {
  const epoch = '12345678-1234-4234-9234-123456789abc'
  const command = 'abcdef12-1234-4234-9234-123456789abc'
  const member = { id: 'character', xp: 975, burden: { shortTrusted: true } }
  const party = () => ({ revision: 4, members: [structuredClone(member)] })
  const registryEntry = (id: string) => ({
    id,
    lastOpenedAt: '2026-09-12T12:00:00Z'
  })
  const source = {
    coverage: 'settings-campaigns-party-own-files-world-combat-travel-v3',
    settings: { preferences: { theme: 'dark' } },
    registry: {
      activeCampaignId: 'active',
      campaigns: ['active', 'inactive'].map(registryEntry),
      trashedCampaigns: [registryEntry('deleted')]
    },
    campaigns: ['active', 'inactive', 'deleted'].map((id) => ({
      id,
      trashed: id === 'deleted',
      party: party(),
      game: {
        session: {
          party: party(),
          travel: { status: 'paused', progress: 0.25 },
          combat: { round: 3 }
        }
      }
    })),
    ownFiles: [
      { path: 'custom.bin', kind: 'file', base64: 'AP8RgCo=' },
      { path: 'empty', kind: 'directory' }
    ]
  }
  const migrated = structuredClone(source)
  Object.assign(migrated.settings.preferences, {
    partyQuickFields: ['armorClass', 'passivePerception']
  })
  for (const c of migrated.campaigns)
    for (const p of [c.party, c.game.session.party])
      Object.assign(p.members[0]!.burden, {
        completedShortRestSections: 0,
        sectionStartXp: 0,
        sectionsTrusted: false
      })
  const continued = structuredClone(migrated)
  continued.registry.campaigns[0]!.lastOpenedAt = '2026-09-12T12:01:00Z'
  for (const p of [
    continued.campaigns[0]!.party,
    continued.campaigns[0]!.game.session.party
  ]) {
    p.revision++
    p.members[0]!.xp += 25
  }
  const sourceHistory = {
    installation: {
      party_history_installation: null,
      party_history_campaign: null,
      party_history_index: null
    },
    campaigns: ['active', 'inactive', '.trash/deleted'].map((id) => ({
      id,
      tables: { party_action_history: null, party_action_receipt: null }
    }))
  }
  const migratedHistory = {
    installation: {
      party_history_installation: [{ singleton: 1, id: epoch }],
      party_history_campaign: [],
      party_history_index: [] as Record<string, unknown>[]
    },
    campaigns: sourceHistory.campaigns.map((c) => ({
      id: c.id,
      tables: {
        party_action_history: [] as Record<string, unknown>[],
        party_action_receipt: [] as Record<string, unknown>[]
      }
    }))
  }
  const continuedHistory = structuredClone(migratedHistory)
  const installation = `${epoch}:active`
  continuedHistory.installation.party_history_index.push({
    campaign_id: 'active',
    epoch: installation,
    command_id: command,
    sequence: 1
  })
  continuedHistory.campaigns[0]!.tables.party_action_history.push({
    id: command,
    sequence: 1,
    installation_id: installation,
    description: 'XP ändern',
    applied: 1,
    payload_json: JSON.stringify({
      party: [
        {
          before: migrated.campaigns[0]!.party.members[0],
          after: continued.campaigns[0]!.party.members[0]
        }
      ],
      scene: { assignments: [], created: [] },
      combat: [],
      travel: [],
      loot: [],
      preferences: null
    })
  })
  continuedHistory.campaigns[0]!.tables.party_action_receipt.push({
    command_id: command,
    installation_id: installation,
    sequence: 1,
    pending: 0,
    preferences_json: null,
    request_fingerprint: 'a'.repeat(64),
    result_json: JSON.stringify({
      characterId: member.id,
      party: continued.campaigns[0]!.party
    })
  })
  const restoredHistory = structuredClone(migratedHistory)
  restoredHistory.installation.party_history_installation[0]!.id =
    '87654321-1234-4234-9234-123456789abc'
  return structuredClone({
    source,
    unchanged: source,
    migrated,
    continued,
    restored: migrated,
    protection: continued,
    protectedRestore: continued,
    secondProtection: migrated,
    history: {
      source: sourceHistory,
      unchanged: structuredClone(sourceHistory),
      migrated: migratedHistory,
      continued: continuedHistory,
      restored: restoredHistory,
      protection: continuedHistory,
      protectedRestore: continuedHistory,
      secondProtection: restoredHistory
    }
  })
}
