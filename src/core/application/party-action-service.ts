import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  partyActionResultSchema,
  partyHistoryCommandSchema,
  partyQuickFieldsCommandSchema,
  type PartyHistoryCommand,
  type PartyQuickFieldsCommand
} from '../../shared/contracts/party-actions.js'
import {
  partyCharacterCommandReceiptSchema,
  type PartyCharacterCommand
} from '../../shared/contracts/party.js'
import {
  scenePartyCommandReceiptSchema,
  type ScenePartyCommand
} from '../../shared/contracts/scene-party-command.js'
import type { SqliteDatabaseAccess } from '../persistence/sqlite/database-access.js'
import { InstallationSettingsStore } from '../persistence/sqlite/installation-settings-store.js'
import {
  PartyHistoryStore,
  type PartyHistoryPayload
} from '../party/party-history-store.js'
import { PartyHistoryIndex } from '../party/party-history-index.js'
import { PartyHistoryOwner } from '../party/party-history-owner.js'
import { ScenePartyHistoryOwner } from '../scene/scene-party-history-owner.js'
import { PartyCombatHistoryOwner } from '../encounter/party-combat-history-owner.js'
import { PartyTravelHistoryOwner } from '../hex/party-travel-history-owner.js'
import { PartyLootHistoryOwner } from '../loot/party-loot-history-owner.js'
import type { LivePlayService } from '../encounter/live-combat.js'

export class PartyActionService {
  constructor(
    private readonly campaign: SqliteDatabaseAccess,
    private readonly installation: SqliteDatabaseAccess,
    private readonly activeCampaignId: () => string,
    private readonly play: LivePlayService
  ) {}
  private context() {
    const campaignId = this.activeCampaignId()
    const index = this.installation.use((db) => new PartyHistoryIndex(db))
    const scope = index.scope(campaignId)
    const db = this.campaign.use((db) => db)
    return {
      db,
      campaignId,
      scope,
      index,
      history: new PartyHistoryStore(db, scope)
    }
  }
  private settings() {
    return this.installation.use((db) =>
      new InstallationSettingsStore(db).read()
    )
  }
  private recover() {
    const context = this.context()
    for (const pending of context.history.pending()) {
      context.index.complete(
        context.campaignId,
        context.scope,
        pending.id,
        pending.sequence,
        pending.preferences
      )
      context.history.complete(pending.id)
    }
    return context
  }
  private owners(db: Database.Database) {
    return {
      party: new PartyHistoryOwner(db),
      scene: new ScenePartyHistoryOwner(db),
      combat: new PartyCombatHistoryOwner(db),
      travel: new PartyTravelHistoryOwner(db),
      loot: new PartyLootHistoryOwner(db, (id) =>
        new PartyHistoryStore(db, this.context().scope).hasCommand(id)
      )
    }
  }
  private conflict(payload: PartyHistoryPayload, undo: boolean): string | null {
    const { db } = this.context()
    const owner = this.owners(db)
    if (
      payload.preferences &&
      JSON.stringify(this.settings().preferences.partyQuickFields) !==
        JSON.stringify(
          undo ? payload.preferences.after : payload.preferences.before
        )
    )
      return 'Die Schnellwerte wurden später geändert.'
    for (const scene of payload.scene.created)
      if (
        undo &&
        (owner.travel.hasState(scene.id) || owner.combat.hasState(scene.id))
      )
        return 'Die neue Szene hat inzwischen eine Reise oder einen Kampf.'
    return (
      owner.party.conflict(payload.party, undo) ??
      owner.scene.conflict(payload.scene, undo) ??
      owner.combat.conflict(payload.combat, undo) ??
      owner.travel.conflict(payload.travel, undo) ??
      owner.loot.conflict(payload.loot, undo)
    )
  }
  history() {
    const { history } = this.recover()
    const entries = history.entries()
    const undo = entries.filter((entry) => entry.applied).at(-1)
    const redo = entries.find((entry) => !entry.applied)
    const summary = (entry: typeof undo, inverse: boolean) =>
      entry
        ? {
            id: entry.id,
            description: entry.description,
            blockedReason: this.conflict(entry.payload, inverse)
          }
        : null
    return {
      undo: summary(undo, true),
      redo: summary(redo, false),
      pending: false
    }
  }
  private execute<T>(
    input: { commandId: string },
    description: string,
    work: () => T,
    preferences: PartyHistoryPayload['preferences'] = null
  ): T {
    const { db, history } = this.recover()
    const result = db.transaction(() => {
      const previous = history.receipt(input)
      if (previous !== null) return previous as T
      const owner = this.owners(db)
      const before = {
        party: owner.party.capture(),
        scene: owner.scene.capture(),
        combat: owner.combat.capture(),
        travel: owner.travel.capture()
      }
      const result = work()
      const payload = {
        party: owner.party.changes(before.party),
        scene: owner.scene.changes(before.scene),
        combat: owner.combat.changes(before.combat),
        travel: owner.travel.changes(before.travel),
        loot: owner.loot.changes(input.commandId),
        preferences
      }
      const sequence = history.append(input.commandId, description, payload)
      history.record(input, result, sequence, preferences)
      return result
    })()
    this.recover()
    return result
  }
  executeCharacter(input: PartyCharacterCommand) {
    // Existing create/delete receipts retain their lifecycle behavior. The Party subview edits profiles.
    if (input.command.kind === 'create' || input.command.kind === 'delete')
      return this.play.executePartyCharacterCommand(input)
    const original = this.play.partyCharacterCommandStatus(input).receipt
    if (original) {
      this.recover()
      return original
    }
    return partyCharacterCommandReceiptSchema.parse(
      this.execute(
        input,
        input.command.kind === 'update'
          ? 'Charakterprofil ändern'
          : 'XP ändern',
        () => this.play.executePartyCharacterCommand(input)
      )
    )
  }
  executeScene(input: ScenePartyCommand) {
    const original = this.play.scenePartyCommandStatus(input).receipt
    if (original) {
      this.recover()
      return original
    }
    const labels = {
      'set-roster': 'Besetzung ändern',
      'move-roster': 'Party verschieben',
      'rest-selected': 'Rasten'
    }
    return scenePartyCommandReceiptSchema.parse(
      this.execute(input, labels[input.command.kind], () =>
        this.play.executeScenePartyCommand(input)
      )
    )
  }
  correctLoot<T>(input: { commandId: string }, work: () => T): T {
    return this.execute(input, 'Loot korrigieren', work)
  }
  quickFields(value: PartyQuickFieldsCommand) {
    const input = partyQuickFieldsCommandSchema.parse(value)
    if (input.campaignId !== this.activeCampaignId())
      throw new CapabilityError('stale', false)
    const { history } = this.recover()
    if (history.receipt(input) === null) {
      const current = this.settings()
      if (input.expectedRevision !== current.revision)
        throw new CapabilityError('stale', true)
      this.execute(input, 'Schnellwerte ändern', () => ({ committed: true }), {
        before: current.preferences.partyQuickFields,
        after: [...input.fields]
      })
    }
    return this.result()
  }
  private result() {
    return partyActionResultSchema.parse({
      snapshot: this.play.readSession(),
      settings: this.settings(),
      history: this.history()
    })
  }
  status(input: PartyHistoryCommand | PartyQuickFieldsCommand) {
    const { history } = this.recover()
    return { committed: history.receipt(input) !== null, result: this.result() }
  }
  undoRedo(value: PartyHistoryCommand) {
    const input = partyHistoryCommandSchema.parse(value)
    if (input.campaignId !== this.activeCampaignId())
      throw new CapabilityError('stale', false)
    const { db, history } = this.recover()
    const stored = history.receipt(input)
    if (stored !== null) return this.result()
    const undo = input.direction === 'undo'
    db.transaction(() => {
      const entries = history.entries()
      const entry = undo
        ? entries.filter((entry) => entry.applied).at(-1)
        : entries.find((entry) => !entry.applied)
      if (
        !entry ||
        entry.id !== input.stepId ||
        this.conflict(entry.payload, undo)
      )
        throw new CapabilityError('stale', false)
      const owner = this.owners(db)
      // Check every owner before changing any of them; all writes share this transaction.
      owner.party.restore(entry.payload.party, undo)
      owner.combat.restore(entry.payload.combat, undo)
      owner.travel.restore(entry.payload.travel, undo)
      owner.scene.restore(entry.payload.scene, undo)
      owner.loot.restore(entry.payload.loot, undo, input.commandId)
      history.mark(entry.id, !undo)
      const preferences = entry.payload.preferences
        ? undo
          ? {
              before: entry.payload.preferences.after,
              after: entry.payload.preferences.before
            }
          : entry.payload.preferences
        : null
      history.record(input, { committed: true }, entry.sequence, preferences)
    })()
    this.recover()
    return this.result()
  }
  invalidate(campaignId: string) {
    this.installation.use((db) =>
      new PartyHistoryIndex(db).invalidate(campaignId)
    )
  }
}
