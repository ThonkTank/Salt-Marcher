import type Database from 'better-sqlite3'
import type { CampaignStore } from '../persistence/sqlite/campaign-store.js'
import {
  LocationSymbolService,
  LocationSymbolStore
} from '../worldplanner/location-symbol-store.js'
import { WorldLocationStore } from '../worldplanner/location-store.js'
import { parseLocationSymbolSource } from '../worldplanner/location-symbol-import.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

/** Coordinates installation-owned symbols with every campaign that references them. */
export class LocationSymbolLifecycleService {
  readonly symbols: LocationSymbolService

  constructor(private readonly campaigns: CampaignStore) {
    this.symbols = new LocationSymbolService(
      this.campaigns.installationPersistenceAccess()
    )
  }

  customSymbol(id: string) {
    return this.symbolStore().get(id)
  }

  locationStore(database: Database.Database): WorldLocationStore {
    return new WorldLocationStore(database, {
      containsFaction: () => false,
      containsEncounterTable: () => false,
      containsLocationSymbol: (id) => this.customSymbol(id) !== null,
      locationSymbol: (id) => this.customSymbol(id)
    })
  }

  deleteImpact(id: string) {
    const symbol = this.customSymbol(id)
    if (!symbol) throw new CapabilityError('not_found', false)
    const usages = this.campaigns
      .visitCampaignDatabases(({ id: campaignId, name, trashed, database }) => {
        const matches = this.locationStore(database).locationsUsingMapSymbol(id)
        return matches.length === 0
          ? null
          : {
              campaignId,
              campaignName: name,
              trashed,
              locationIds: matches.map((match) => match.id),
              locationNames: matches.map((match) => match.displayName)
            }
      })
      .filter((usage) => usage !== null)
    return {
      symbolId: id,
      symbolName: symbol.displayName,
      totalLocations: usages.reduce(
        (total, usage) => total + usage.locationIds.length,
        0
      ),
      usages
    }
  }

  delete(input: { commandId: string; id: string; expectedRevision: number }) {
    const store = this.symbolStore()
    const existing = store.deletionJob(input.commandId)
    if (
      existing &&
      (existing.symbolId !== input.id ||
        existing.expectedRevision !== input.expectedRevision)
    )
      throw new CapabilityError('validation_failed', false)
    if (existing?.state === 'completed')
      return {
        status: 'replayed' as const,
        symbols: this.symbols.read(),
        activeChangedLocationIds: []
      }
    if (!existing) this.deleteImpact(input.id)
    store.beginDeletion(input.commandId, input.id, input.expectedRevision)
    const activeChangedLocationIds = this.replaceReferences(input.id)
    return {
      status: 'applied' as const,
      symbols: this.executeDeletion(input),
      activeChangedLocationIds
    }
  }

  recoverPendingDeletions(): void {
    for (const pending of this.symbolStore().pendingDeletions()) {
      const input = {
        commandId: pending.commandId,
        id: pending.symbolId,
        expectedRevision: pending.expectedRevision
      }
      this.replaceReferences(input.id)
      this.executeDeletion(input)
    }
  }

  recoverPendingImports(): void {
    const store = this.symbolStore()
    for (const pending of store.pendingImports()) {
      let assigned = false
      this.campaigns.visitCampaignDatabases(({ id, database }) => {
        if (id !== pending.campaignId) return
        try {
          assigned =
            this.locationStore(database).mapPresentation(pending.locationId)
              .symbolId === pending.createdSymbolId
        } catch {
          assigned = false
        }
      })
      if (assigned) store.completeImport(pending.commandId)
      else store.cancelImport(pending.commandId)
    }
  }

  importAndAssign(input: {
    commandId: string
    displayName: string
    source: string
    locationId: string
    expectedSymbolRevision: number
    expectedPresentationRevision: number
  }) {
    const draft = parseLocationSymbolSource(input.source, input.displayName)
    const store = this.symbolStore()
    const job = store.beginImport({
      commandId: input.commandId,
      campaignId: this.campaigns.activeCampaignId(),
      locationId: input.locationId,
      expectedPresentationRevision: input.expectedPresentationRevision,
      symbol: draft,
      expectedSymbolRevision: input.expectedSymbolRevision
    })
    if (job.state === 'cancelled')
      throw new CapabilityError('validation_failed', false)
    return this.campaigns.activeCampaignPersistence().use((database) => {
      const locations = this.locationStore(database)
      const current = locations.mapPresentation(input.locationId)
      if (current.symbolId === job.createdSymbolId) {
        store.completeImport(input.commandId)
        return {
          status: 'replayed' as const,
          symbols: job.symbols,
          presentation: current,
          createdSymbolId: job.createdSymbolId
        }
      }
      if (job.state === 'completed') throw new CapabilityError('stale', true)
      try {
        const presentation = locations.updateMapPresentation(
          input.locationId,
          { symbolId: job.createdSymbolId },
          job.expectedPresentationRevision
        )
        store.completeImport(input.commandId)
        return {
          status: 'applied' as const,
          symbols: job.symbols,
          presentation,
          createdSymbolId: job.createdSymbolId
        }
      } catch (error) {
        store.cancelImport(input.commandId)
        throw error
      }
    })
  }

  private replaceReferences(symbolId: string): string[] {
    const activeId = this.campaigns.list().activeCampaignId
    const activeChanges: string[] = []
    this.campaigns.visitCampaignDatabases(({ id, database }) => {
      const changed = this.locationStore(database).replaceMapSymbol(symbolId)
      if (id === activeId) activeChanges.push(...changed)
    })
    return activeChanges
  }

  private executeDeletion(input: {
    commandId: string
    id: string
    expectedRevision: number
  }) {
    const store = this.symbolStore()
    store.beginDeletion(input.commandId, input.id, input.expectedRevision)
    if (store.get(input.id)) store.remove(input.id, input.expectedRevision)
    store.completeDeletion(input.commandId)
    return this.symbols.read()
  }

  private symbolStore(): LocationSymbolStore {
    return this.campaigns
      .installationPersistenceAccess()
      .use((database) => new LocationSymbolStore(database))
  }
}
