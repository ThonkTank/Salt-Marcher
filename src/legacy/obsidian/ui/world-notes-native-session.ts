import type { FileStore } from "../../../persistence";
import { FileTransaction } from "../../../features/atlas/file-transaction";
import { campaignLocalId, sameSnapshot,
  type CampaignCommandId, type CampaignContextProjection, type CampaignId,
  type CampaignNamespace } from "../../../features/campaign/campaign-contracts";
import type { CampaignOwnershipDigest } from "../../../features/campaign/campaign-ownership";
import { WorldNotesCampaignCommitParticipant, worldNotePath,
  type WorldNotesCommitReceiptV1 } from "../../../features/campaign/world-notes-commit";
import { parseCampaignRuntimeManifest, type CampaignRuntimeStorage } from "../../../features/campaign/campaign-runtime-source";
import { changeWorldNotes, serializeWorldNote,
  type WorldNoteChange, type WorldNoteKind, type WorldNotesSnapshotV1 } from "../../../features/world/world-notes";
import type { AtlasCampaignServices } from "./atlas-campaign-host";
import { readConfirmedWorldNotes, type ConfirmedWorldNotes } from "./world-notes-native-reader";
import type { WorldNotesCommitResult } from "./world-notes-panel";

function transactionFor(input: { readonly files: FileStore; readonly manifestPath: string;
  readonly namespace: CampaignNamespace; readonly scope: object;
  readonly participant: WorldNotesCampaignCommitParticipant; readonly assertCurrent?: () => void }): FileTransaction {
  const journalPath = input.manifestPath.replace(/\.campaign\.json$/, ".world-notes.journal");
  const allowed = (path: string) => {
    if (path === input.manifestPath) return true;
    const match = /^Kampagnen\/SaltMarcher\/[^/]+\/Weltwissen\/(note|npc|faction|quest|rumor|rule)\/([^/]+)\.world-note\.json$/.exec(path);
    if (!match) return false;
    try { return worldNotePath(input.namespace, match[1] as WorldNoteKind,
      campaignLocalId(match[2]!)) === path; } catch { return false; }
  };
  return new FileTransaction(input.files, journalPath, allowed, input.scope,
    (journal) => input.participant.validateRecovery(journal), input.assertCurrent);
}

/** Resolve an interrupted note journal before activating a fresh Campaign mount. */
export async function recoverWorldNotesBeforeActivation(input: {
  readonly campaignId: CampaignId;
  readonly storage: CampaignRuntimeStorage;
  readonly files: FileStore;
  readonly digest: CampaignOwnershipDigest;
  readonly serializationScope: object;
}): Promise<void> {
  const matches = (await input.storage.list()).filter((file) => {
    try { return parseCampaignRuntimeManifest(file.bytes, input.digest).snapshot.campaignId === input.campaignId; }
    catch { return false; }
  });
  if (matches.length !== 1) throw new Error("World-Recovery benötigt genau ein bestätigtes Campaignmanifest.");
  const file = matches[0]!, manifest = parseCampaignRuntimeManifest(file.bytes, input.digest),
    participant = new WorldNotesCampaignCommitParticipant(file.path, file.bytes, input.digest);
  await transactionFor({ files: input.files, manifestPath: file.path,
    namespace: manifest.snapshot.namespace, scope: input.serializationScope, participant }).recover();
}

/** One mounted Campaign context. Every write goes through its owner participant and FileTransaction. */
export class WorldNotesNativeSession {
  private confirmed: ConfirmedWorldNotes | null = null;
  private readonly issuers = new WeakMap<object, WorldNotesCampaignCommitParticipant>();
  private closed = false;
  constructor(
    private readonly services: AtlasCampaignServices,
    private readonly storage: CampaignRuntimeStorage,
    private readonly files: FileStore,
    private readonly digest: CampaignOwnershipDigest,
    private readonly serializationScope: object,
    private readonly context: CampaignContextProjection,
  ) {}
  private assertCurrent = () => {
    this.services.assertOpen?.();
    const current = this.services.provider.currentContext();
    if (this.closed || !current || current.lifecycle !== "active" ||
        !sameSnapshot(current, this.context) || current.contextToken !== this.context.contextToken)
      throw new Error("World-Notes-Kampagnenbindung wurde widerrufen.");
  };
  close(): void { this.closed = true; }
  async open(): Promise<WorldNotesSnapshotV1> {
    this.assertCurrent();
    const confirmed = await readConfirmedWorldNotes({ storage: this.storage,
      files: this.files, digest: this.digest, context: this.context,
      currentContext: () => this.services.provider.currentContext() });
    this.assertCurrent();
    this.confirmed = confirmed;
    return confirmed.snapshot;
  }
  validateReceipt = (receipt: WorldNotesCommitReceiptV1): void => {
    const participant = this.issuers.get(receipt);
    if (!participant) throw new Error("World-Receipt stammt nicht aus diesem nativen Save.");
    participant.validateReceipt(receipt);
  };
  async commit(commandId: CampaignCommandId, change: WorldNoteChange,
    expectedRevision: number): Promise<WorldNotesCommitResult> {
    this.assertCurrent();
    const previous = this.confirmed;
    if (!previous || previous.snapshot.revision !== expectedRevision)
      throw new Error("World-Entwurf besitzt keine aktuelle bestätigte Basis.");
    const current = await readConfirmedWorldNotes({ storage: this.storage,
      files: this.files, digest: this.digest, context: this.context,
      currentContext: () => this.services.provider.currentContext() });
    this.assertCurrent();
    if (current.manifestPath !== previous.manifestPath ||
        current.manifestBytes !== previous.manifestBytes ||
        JSON.stringify(current.snapshot) !== JSON.stringify(previous.snapshot))
      throw new Error("World-Bestand hat sich seit dem Öffnen geändert.");
    const after = changeWorldNotes(current.snapshot, this.context,
      this.services.provider.currentContext(), expectedRevision, change);
    const participant = await this.services.createWorldNotesSave?.({
      context: this.context, assertCurrent: this.assertCurrent });
    if (!participant || participant.manifestPath !== current.manifestPath)
      throw new Error("Bestätigter nativer World-Speicheranschluss fehlt.");
    this.assertCurrent();
    const nativeWrites = after.records.map((record) => {
      const beforeRecord = current.snapshot.records.find((old) => old.id === record.id);
      return { path: worldNotePath(after.namespace, record.kind, record.id),
        before: beforeRecord ? serializeWorldNote(beforeRecord) : null,
        after: serializeWorldNote(record) };
    });
    const prepared = participant.prepare({ commandId, context: this.context,
      beforeSnapshot: current.snapshot, afterSnapshot: after, change, nativeWrites });
    const transaction = transactionFor({ files: this.files, manifestPath: current.manifestPath,
      namespace: after.namespace, scope: this.serializationScope, participant,
      assertCurrent: this.assertCurrent });
    let receipt: WorldNotesCommitReceiptV1 | null = null;
    const changed = await transaction.commit(prepared.writes,
      participant.transactionObserver(prepared, transaction, (issued) => {
        receipt = issued;
        this.issuers.set(issued, participant);
      }));
    if (!changed || !receipt) throw new Error("World-Save besitzt kein bestätigtes Commit-Receipt.");
    this.assertCurrent();
    const loaded = await readConfirmedWorldNotes({ storage: this.storage,
      files: this.files, digest: this.digest, context: this.context,
      currentContext: () => this.services.provider.currentContext() });
    if (JSON.stringify(loaded.snapshot) !== JSON.stringify(after))
      throw new Error("World-Save wurde nicht mit bestätigten nativen Bytes wiedergefunden.");
    this.confirmed = loaded;
    return { snapshot: loaded.snapshot, receipt };
  }
}
