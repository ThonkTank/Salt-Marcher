import {
  campaignLocalId,
  payloadDigest,
  revisionToken,
  type CampaignContextProjection,
  type CampaignLocalId,
} from "./campaign-contracts";
import {
  campaignDomainOwnerPolicyDigest,
  campaignDomainOwnershipProjection,
  campaignDomainOwnershipProjectionDigest,
  type CampaignDomainOwnershipProjectionV1,
  type CampaignMultiOwnerStageInputV1,
  type CampaignOwnerRegistryPort,
  type CampaignOwnershipDigest,
} from "./campaign-ownership";

type Digest = string;

export interface MwsImportMediaAssetV1 {
  readonly sourceId: CampaignLocalId;
  readonly availability: "available" | "missing";
  readonly metadataDigest: Digest | null;
  readonly byteDigest: Digest | null;
}

export interface MwsImportMediaInventoryV1 {
  readonly version: 1;
  readonly importId: string;
  readonly revision: string;
  readonly assets: readonly MwsImportMediaAssetV1[];
}

export type MwsImportMediaInventoryReadOutcome =
  | { readonly kind: "confirmed"; readonly inventory: MwsImportMediaInventoryV1 }
  | { readonly kind: "unknown" | "unavailable" };

export type MwsImportMediaInventoryVerifyOutcome =
  | { readonly kind: "current" }
  | { readonly kind: "stale" | "unknown" | "unavailable" };

export interface MwsImportMediaInventoryPort {
  read(expected: {
    readonly context: CampaignContextProjection;
    readonly registryId: string;
    readonly registryRevision: string;
    readonly projectionDigest: Digest;
    readonly audioSourceIds: readonly CampaignLocalId[];
  }): Promise<MwsImportMediaInventoryReadOutcome>;
  verify(expected: MwsImportMediaInventoryV1): Promise<MwsImportMediaInventoryVerifyOutcome>;
}

export interface MwsCompleteImportMediaRowV1 {
  readonly sourceId: CampaignLocalId;
  readonly recordType: string;
  readonly status: "verified" | "missing" | "hash-mismatch" | "retained" |
    "fresh-target" | "omitted" | "quarantined";
  readonly action: "transfer" | "fresh-target" | "omit" | "quarantine";
  readonly reason: string | null;
  readonly impact: string | null;
  readonly retention: "opaque" | "unknown-retained" | null;
  readonly message: string;
}

export interface MwsCompleteImportMediaReviewV1 {
  readonly version: 1;
  readonly title: "Medienprüfung";
  readonly mode: "complete" | "salvage";
  readonly outcome: "ready" | "blocked" | "confirmation-required";
  readonly decisionId: string | null;
  readonly rows: readonly MwsCompleteImportMediaRowV1[];
  readonly summary: string;
}

interface ReviewState {
  readonly projection: CampaignDomainOwnershipProjectionV1;
  readonly inventory: MwsImportMediaInventoryV1;
  readonly input: CampaignMultiOwnerStageInputV1;
}

const MEDIA_TYPES = new Set([
  "audio-source",
  "music-cue",
  "scene-audio",
  "runtime-audio",
  "manual-decision",
  "ambience-override",
]);

function sameContext(a: CampaignContextProjection, b: CampaignContextProjection): boolean {
  return a.campaignId === b.campaignId && a.revision === b.revision &&
    a.namespace === b.namespace && a.lifecycle === b.lifecycle &&
    a.contextToken === b.contextToken;
}

function immutable<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function checkedInventory(
  raw: MwsImportMediaInventoryV1,
  expectedIds: readonly CampaignLocalId[],
): MwsImportMediaInventoryV1 {
  if (!raw || typeof raw !== "object" || raw.version !== 1)
    throw new Error("Ungültiges Medieninventar.");
  const importId = revisionToken(raw.importId, "Import-ID"),
    revision = revisionToken(raw.revision, "Medieninventar-Revision");
  if (!Array.isArray(raw.assets) || Object.keys(raw.assets).length !== raw.assets.length)
    throw new Error("Ungültige Medieninventar-Einträge.");
  const assets = raw.assets.map((asset) => {
    if (!asset || typeof asset !== "object" ||
        (asset.availability !== "available" && asset.availability !== "missing"))
      throw new Error("Ungültiger Medieninventar-Eintrag.");
    const sourceId = campaignLocalId(String(asset.sourceId));
    if (asset.availability === "missing") {
      if (asset.metadataDigest !== null || asset.byteDigest !== null)
        throw new Error("Fehlendes Medium darf keine Hashbelege behaupten.");
      return Object.freeze({ sourceId, availability: "missing" as const,
        metadataDigest: null, byteDigest: null });
    }
    if (asset.metadataDigest === null || asset.byteDigest === null)
      throw new Error("Verfügbares Medium braucht vollständige Hashbelege.");
    return Object.freeze({ sourceId, availability: "available" as const,
      metadataDigest: payloadDigest(asset.metadataDigest), byteDigest: payloadDigest(asset.byteDigest) });
  }).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  if (new Set(assets.map((asset) => asset.sourceId)).size !== assets.length)
    throw new Error("Doppelte Medieninventar-Evidenz.");
  const actualIds = assets.map((asset) => asset.sourceId), expected = [...expectedIds].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expected))
    throw new Error("Medieninventar ist unvollständig oder enthält fremde Einträge.");
  return Object.freeze({ version: 1, importId, revision, assets: Object.freeze(assets) });
}

function sourceSet(input: CampaignMultiOwnerStageInputV1): ReadonlySet<string> {
  return new Set(input.closure
    .filter((item) => item.entityType !== "campaign" && item.entityType !== "namespace")
    .map((item) => item.sourceId));
}

function validateMwsTransfer(
  projection: CampaignDomainOwnershipProjectionV1,
  input: CampaignMultiOwnerStageInputV1,
): void {
  if (input.kind !== "complete-import" && input.kind !== "salvage-import")
    throw new Error("Medienprüfung unterstützt nur Complete- oder Salvage-Import.");
  const records = projection.owners.flatMap((owner) => owner.records
      .filter((record) => MEDIA_TYPES.has(record.recordType))
      .map((record) => ({ owner, record }))),
    mapped = sourceSet(input), salvage = input.salvage,
    omitted = new Set(salvage?.omissions.map((item) => item.sourceId) ?? []),
    quarantined = new Set(salvage?.quarantine.map((item) => item.sourceId) ?? []);
  const sourceIds = new Set(projection.owners.flatMap((owner) => owner.records.map((record) => record.id))),
    targetIds = new Set<string>();
  for (const { owner, record } of records) {
    const participant = input.participants.find((item) => item.ownerId === owner.ownerId);
    if (!participant || participant.ownerRevision !== owner.ownerRevision ||
        participant.schemaRevision !== owner.schemaRevision ||
        participant.snapshotRevision !== owner.snapshotRevision ||
        participant.policyRevision !== owner.policyRevision ||
        participant.policyDigest !== owner.policyDigest)
      throw new Error("Medien-Ownerteilnehmer ist stale oder fehlt.");
    if (record.recordType === "ambience-override") {
      if (mapped.has(record.id) || omitted.has(record.id) || quarantined.has(record.id))
        throw new Error("AmbienceOverride darf nicht in die Zielclosure gelangen.");
      const target = input.freshTargets.find((item) => item.sourceRecordId === record.id);
      if (!target || target.ownerId !== owner.ownerId || target.recordType !== record.recordType ||
          target.policyRevision !== owner.policyRevision || target.policyDigest !== owner.policyDigest)
        throw new Error("AmbienceOverride benötigt eine ownerbestätigte frische Zielprojektion.");
      if (sourceIds.has(target.targetId) || targetIds.has(target.targetId))
        throw new Error("Frische Medienzielidentität ist nicht unabhängig.");
      targetIds.add(target.targetId);
      continue;
    }
    const mappings = input.closure.filter((item) => item.sourceId === record.id);
    if (mapped.has(record.id)) {
      const targetId = mappings.length === 1 ? campaignLocalId(mappings[0]!.targetId) : null;
      if (mappings.length !== 1 || mappings[0]!.entityType !== record.recordType ||
          targetId === record.id || (targetId !== null && sourceIds.has(targetId)) ||
          (targetId !== null && targetIds.has(targetId)))
        throw new Error("Medien-ID-Remap ist unvollständig, typfremd oder kollidierend.");
      targetIds.add(targetId!);
    }
    if (record.recordType === "manual-decision" && !mapped.has(record.id))
      throw new Error("ManualDecision muss dauerhaft als Survivor erhalten bleiben.");
    if (input.kind === "complete-import" && !mapped.has(record.id))
      throw new Error("Complete-Import lässt einen Medienrecord aus.");
  }
  if (input.kind === "complete-import") {
    if (salvage !== null) throw new Error("Complete-Import darf keine Salvage-Entscheidung tragen.");
  } else if (!salvage) throw new Error("Salvage-Import braucht eine explizite Entscheidung.");
  if (salvage) {
    revisionToken(salvage.decisionId, "Salvage-Entscheidung");
    for (const { record } of records) {
      if (record.recordType === "ambience-override") continue;
      const count = Number(mapped.has(record.id)) + Number(omitted.has(record.id)) + Number(quarantined.has(record.id));
      if (count !== 1) throw new Error("Medien-Salvage ist nicht vollständig oder disjunkt.");
      if (mapped.has(record.id)) {
        for (const reference of record.references)
          if (reference.scope === "campaign-local" &&
              records.some((item) => item.record.id === reference.id) && !mapped.has(reference.id))
            throw new Error("Medien-Survivor hängt von einem ausgelassenen Medienrecord ab.");
      }
    }
  }
}

export class MwsCompleteImportMediaAdapter {
  private readonly reviews = new WeakMap<MwsCompleteImportMediaReviewV1, ReviewState>();

  constructor(
    private readonly registry: CampaignOwnerRegistryPort,
    private readonly inventory: MwsImportMediaInventoryPort,
    private readonly digest: CampaignOwnershipDigest,
  ) {}

  async review(
    context: CampaignContextProjection,
    input: CampaignMultiOwnerStageInputV1,
  ): Promise<MwsCompleteImportMediaReviewV1> {
    const contextSnapshot = immutable(structuredClone(context)) as CampaignContextProjection,
      inputSnapshot = immutable(structuredClone(input)) as CampaignMultiOwnerStageInputV1;
    const read = await this.registry.read(contextSnapshot);
    if (read.kind !== "confirmed") throw new Error(`Owner-Registry ist ${read.kind}.`);
    const projection = campaignDomainOwnershipProjection(read.projection);
    if (!sameContext(contextSnapshot, projection.context))
      throw new Error("Owner-Registry gehört zu einem anderen Campaigncontext.");
    if (campaignDomainOwnershipProjectionDigest(projection, this.digest) !== projection.projectionDigest)
      throw new Error("Ownership-Projektionsdigest ist stale.");
    for (const owner of projection.owners)
      if (campaignDomainOwnerPolicyDigest(owner, this.digest) !== owner.policyDigest)
        throw new Error("Owner-Transferpolicy-Digest ist stale.");
    validateMwsTransfer(projection, inputSnapshot);
    const audio = projection.owners.flatMap((owner) => owner.records
      .filter((record) => record.recordType === "audio-source")), audioIds = audio.map((record) => record.id).sort();
    const inventoryRead = await this.inventory.read(Object.freeze({
      context: projection.context, registryId: projection.registryId,
      registryRevision: projection.registryRevision, projectionDigest: projection.projectionDigest,
      audioSourceIds: Object.freeze(audioIds),
    }));
    if (inventoryRead.kind !== "confirmed")
      throw new Error(`Medieninventar ist ${inventoryRead.kind}.`);
    const inventory = checkedInventory(inventoryRead.inventory, audioIds), mapped = sourceSet(inputSnapshot),
      omissions = new Map(inputSnapshot.salvage?.omissions.map((item) => [item.sourceId, item]) ?? []),
      quarantine = new Map(inputSnapshot.salvage?.quarantine.map((item) => [item.sourceId, item]) ?? []);
    let blocked = false;
    const rows = audio.map((record): MwsCompleteImportMediaRowV1 => {
      const asset = inventory.assets.find((item) => item.sourceId === record.id)!;
      let status: MwsCompleteImportMediaRowV1["status"] = "verified";
      if (asset.availability === "missing") status = "missing";
      else if (asset.metadataDigest !== record.media!.metadataDigest || asset.byteDigest !== record.media!.byteDigest)
        status = "hash-mismatch";
      let action: MwsCompleteImportMediaRowV1["action"] = "transfer", message = "Medium vollständig verifiziert.";
      let reason: string | null = null, impact: string | null = null,
        retention: MwsCompleteImportMediaRowV1["retention"] = null;
      if (inputSnapshot.kind === "complete-import") {
        if (status !== "verified") { blocked = true; message = status === "missing"
          ? "Medium fehlt; Complete-Import ist blockiert."
          : "Medienhash weicht ab; Complete-Import ist blockiert."; }
      } else if (status === "verified") {
        if (!mapped.has(record.id)) { blocked = true; message = "Verifiziertes Medium wurde nicht als Survivor übernommen."; }
      } else if (status === "missing") {
        action = "omit";
        if (!omissions.has(record.id) || mapped.has(record.id) || quarantine.has(record.id)) {
          blocked = true; message = "Fehlendes Medium braucht genau eine offengelegte Auslassung.";
        } else {
          const item = omissions.get(record.id)!;
          reason = item.reason; impact = item.impact; message = `${item.reason}: ${item.impact}`;
        }
      } else {
        action = "quarantine";
        if (!quarantine.has(record.id) || mapped.has(record.id) || omissions.has(record.id)) {
          blocked = true; message = "Hashabweichung braucht genau eine retained Quarantäne.";
        } else {
          const item = quarantine.get(record.id)!;
          reason = item.reason; retention = item.retention;
          message = `${item.reason} (${item.retention})`;
        }
      }
      return Object.freeze({ sourceId: record.id, recordType: record.recordType, status, action,
        reason, impact, retention, message });
    });
    const otherRows = projection.owners.flatMap((owner) => owner.records.filter((record) =>
      MEDIA_TYPES.has(record.recordType) && record.recordType !== "audio-source").map((record): MwsCompleteImportMediaRowV1 => {
      if (record.recordType === "ambience-override") return Object.freeze({
        sourceId: record.id, recordType: record.recordType, status: "fresh-target" as const,
        action: "fresh-target" as const,
        reason: null, impact: null, retention: null,
        message: "Quellengebundener Override wird nicht übertragen; frische Zielprojektion ist bestätigt.",
      });
      const omission = omissions.get(record.id), retained = quarantine.get(record.id);
      if (omission) return Object.freeze({ sourceId: record.id, recordType: record.recordType,
        status: "omitted" as const, action: "omit" as const, reason: omission.reason,
        impact: omission.impact, retention: null, message: `${omission.reason}: ${omission.impact}` });
      if (retained) return Object.freeze({ sourceId: record.id, recordType: record.recordType,
        status: "quarantined" as const, action: "quarantine" as const,
        reason: retained.reason, impact: null, retention: retained.retention,
        message: `${retained.reason} (${retained.retention})` });
      return Object.freeze({ sourceId: record.id, recordType: record.recordType,
        status: "retained" as const, action: "transfer" as const,
        reason: null, impact: null, retention: null,
        message: record.recordType === "manual-decision"
          ? "Dauerhafte manuelle Entscheidung bleibt als Survivor erhalten."
          : "Medienabhängigkeit wird mit vollständigem ID-Remap übertragen." });
    }));
    const allRows = [...rows, ...otherRows].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    const mode = inputSnapshot.kind === "complete-import" ? "complete" as const : "salvage" as const,
      outcome = blocked ? "blocked" as const : mode === "salvage" ? "confirmation-required" as const : "ready" as const,
      decisionId = mode === "salvage" ? inputSnapshot.salvage!.decisionId : null,
      review = immutable({ version: 1 as const, title: "Medienprüfung" as const, mode, outcome, decisionId,
        rows: Object.freeze(allRows), summary: blocked ? "Import ist wegen der Medienprüfung blockiert."
          : mode === "salvage" ? "Salvage-Auswirkungen müssen ausdrücklich bestätigt werden."
            : "Alle Audiodaten sind vollständig und hashverifiziert." });
    this.reviews.set(review, { projection, inventory, input: inputSnapshot });
    return review;
  }

  async accept(
    review: MwsCompleteImportMediaReviewV1,
    confirmedDecisionId: string | null = null,
  ): Promise<CampaignMultiOwnerStageInputV1> {
    const state = this.reviews.get(review);
    if (!state) throw new Error("Medienreview stammt nicht von diesem Adapter.");
    if (review.outcome === "blocked") throw new Error("Blockierter Medienimport kann nicht bestätigt werden.");
    if (review.outcome === "confirmation-required" &&
        revisionToken(String(confirmedDecisionId), "Salvage-Bestätigung") !== review.decisionId)
      throw new Error("Salvage-Auswirkungen wurden nicht ausdrücklich bestätigt.");
    const [registry, inventory] = await Promise.all([
      this.registry.verify(state.projection),
      this.inventory.verify(state.inventory),
    ]);
    if (registry.kind !== "current") throw new Error(`Owner-Registry ist ${registry.kind}.`);
    if (inventory.kind !== "current") throw new Error(`Medieninventar ist ${inventory.kind}.`);
    return state.input;
  }
}
