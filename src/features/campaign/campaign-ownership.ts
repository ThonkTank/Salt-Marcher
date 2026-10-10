import {
  campaignCommandId,
  campaignContext,
  campaignContextToken,
  campaignId,
  campaignLocalId,
  campaignNamespace,
  campaignReceiptId,
  identityType,
  ownerId,
  payloadDigest,
  referenceSchema,
  revisionToken,
  type CampaignCommandId,
  type CampaignContextProjection,
  type CampaignIdRemapV1,
  type CampaignLocalId,
  type CampaignReceiptId,
} from "./campaign-contracts";

type Digest = string;

export interface CampaignOwnershipReferenceV1 {
  readonly id: string;
  readonly scope: "campaign-local" | "shared";
  readonly schema: string;
}
export interface CampaignOwnershipRecordV1 {
  readonly id: CampaignLocalId;
  readonly recordType: string;
  readonly references: readonly CampaignOwnershipReferenceV1[];
  readonly payloadDigest: Digest;
  readonly media: {
    readonly metadataDigest: Digest;
    readonly byteDigest: Digest;
  } | null;
}
export interface CampaignDomainOwnerProjectionV1 {
  readonly ownerId: string;
  readonly ownerRevision: string;
  readonly schemaRevision: string;
  readonly snapshotRevision: string;
  readonly availability: "confirmed";
  readonly emptyConfirmed: boolean;
  readonly referenceSchemas: readonly string[];
  readonly source: {
    readonly adapterType: string;
    readonly generation: string;
  };
  readonly records: readonly CampaignOwnershipRecordV1[];
}
export interface CampaignDomainOwnershipProjectionV1 {
  readonly version: 1;
  readonly registryId: string;
  readonly registryRevision: string;
  readonly projectionDigest: Digest;
  readonly context: CampaignContextProjection;
  readonly owners: readonly CampaignDomainOwnerProjectionV1[];
}
export type CampaignOwnershipReadOutcome =
  | { readonly kind: "confirmed"; readonly projection: CampaignDomainOwnershipProjectionV1 }
  | { readonly kind: "unknown" | "unavailable" };
export type CampaignOwnershipVerifyOutcome =
  | { readonly kind: "current" }
  | { readonly kind: "stale" | "unknown" | "unavailable" };
export interface CampaignOwnerRegistryPort {
  read(expectedContext: CampaignContextProjection): Promise<CampaignOwnershipReadOutcome>;
  verify(expected: CampaignDomainOwnershipProjectionV1): Promise<CampaignOwnershipVerifyOutcome>;
}

export interface CampaignCommandParticipantV1 {
  readonly ownerId: string;
  readonly ownerRevision: string;
  readonly schemaRevision: string;
  readonly snapshotRevision: string;
  readonly beforeDigest: Digest;
  readonly afterDigest: Digest;
}
export interface CampaignSalvageOmissionV1 {
  readonly sourceId: CampaignLocalId;
  readonly reason: string;
  readonly impact: string;
}
export interface CampaignSalvageQuarantineV1 {
  readonly sourceId: CampaignLocalId;
  readonly retention: "opaque" | "unknown-retained";
  readonly originalDigest: Digest;
  readonly reason: string;
  readonly referenceIds: readonly string[];
}
export interface CampaignSalvageProjectionV1 {
  readonly decisionId: string;
  readonly survivors: readonly CampaignIdRemapV1[];
  readonly omissions: readonly CampaignSalvageOmissionV1[];
  readonly quarantine: readonly CampaignSalvageQuarantineV1[];
  readonly survivorDigest: Digest;
  readonly omissionDigest: Digest;
  readonly quarantineDigest: Digest;
}
export type CampaignMultiOwnerCommandKind =
  | "spatial-write"
  | "complete-copy"
  | "complete-import"
  | "salvage-import";
export interface CampaignMultiOwnerCommandEnvelopeV1 {
  readonly version: 1;
  readonly commandId: CampaignCommandId;
  readonly receiptId: CampaignReceiptId;
  readonly kind: CampaignMultiOwnerCommandKind;
  readonly fingerprint: Digest;
  readonly context: CampaignContextProjection;
  readonly registryId: string;
  readonly registryRevision: string;
  readonly projectionDigest: Digest;
  readonly participants: readonly CampaignCommandParticipantV1[];
  readonly closure: readonly CampaignIdRemapV1[];
  readonly salvage: CampaignSalvageProjectionV1 | null;
}
export interface CampaignMultiOwnerPublishRequestV1 {
  readonly version: 1;
  readonly envelope: CampaignMultiOwnerCommandEnvelopeV1;
  readonly preconditions: {
    readonly context: CampaignContextProjection;
    readonly registryId: string;
    readonly registryRevision: string;
    readonly projectionDigest: Digest;
    readonly participants: readonly CampaignCommandParticipantV1[];
  };
}
export type CampaignMultiOwnerPublishOutcome =
  | { readonly kind: "confirmed" }
  | { readonly kind: "conflict" }
  | { readonly kind: "outcome_unknown" };
export interface CampaignMultiOwnerPublishPort {
  /** Atomically compares every request precondition at the durable linearization point. */
  publish(request: CampaignMultiOwnerPublishRequestV1): Promise<CampaignMultiOwnerPublishOutcome>;
  status(commandId: CampaignCommandId, receiptId: CampaignReceiptId): Promise<CampaignMultiOwnerPublishOutcome>;
}
export type CampaignOwnershipDigest = (canonical: string) => Digest;

export interface CampaignMultiOwnerStageInputV1 {
  readonly commandId: CampaignCommandId;
  readonly receiptId: CampaignReceiptId;
  readonly kind: CampaignMultiOwnerCommandKind;
  readonly participants: readonly CampaignCommandParticipantV1[];
  readonly closure: readonly CampaignIdRemapV1[];
  readonly salvage: CampaignSalvageProjectionV1 | null;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value) || Object.keys(value).length !== value.length)
    throw new Error(`Ungültige ${label}.`);
  return value;
}
function token(value: unknown, label: string): string {
  return revisionToken(String(value), label);
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > 500)
    throw new Error(`Ungültige ${label}.`);
  return value;
}
function referenceId(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 200 || /\s/.test(value))
    throw new Error("Ungültige Referenz-ID.");
  return value;
}
function sameContext(a: CampaignContextProjection, b: CampaignContextProjection): boolean {
  return a.campaignId === b.campaignId && a.revision === b.revision &&
    a.namespace === b.namespace && a.lifecycle === b.lifecycle &&
    a.contextToken === b.contextToken;
}
function checkedContext(value: CampaignContextProjection): CampaignContextProjection {
  return campaignContext({
    schemaVersion: 1,
    campaignId: value.campaignId,
    revision: value.revision,
    name: value.name,
    namespace: value.namespace,
    lifecycle: value.lifecycle,
  }, campaignContextToken(String(value.contextToken)));
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) =>
      `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function checkedDigest(digest: CampaignOwnershipDigest, value: unknown): Digest {
  return payloadDigest(digest(stable(value)));
}
export function campaignOwnershipDigestValue(
  value: unknown,
  digest: CampaignOwnershipDigest,
): Digest {
  return checkedDigest(digest, value);
}

export function campaignDomainOwnershipProjection(
  value: CampaignDomainOwnershipProjectionV1,
): CampaignDomainOwnershipProjectionV1 {
  if (!value || typeof value !== "object" || value.version !== 1)
    throw new Error("Ungültige Ownershipprojektion.");
  const context = checkedContext(value.context),
    recordOwners = new Map<string, string>(),
    records = new Map<string, CampaignOwnershipRecordV1>();
  const owners = array(value.owners, "Ownership-Owner").map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Ungültiger Ownership-Owner.");
    const owner = raw as CampaignDomainOwnerProjectionV1;
    if (owner.availability !== "confirmed") throw new Error("Owner ist nicht bestätigt verfügbar.");
    const id = ownerId(owner.ownerId), schemas = array(owner.referenceSchemas, "Referenzschemas")
      .map((schema) => referenceSchema(String(schema))).sort();
    if (!schemas.length || new Set(schemas).size !== schemas.length)
      throw new Error("Ungültige Referenzschemas.");
    const checkedRecords = array(owner.records, "Ownership-Records").map((recordRaw) => {
      if (!recordRaw || typeof recordRaw !== "object") throw new Error("Ungültiger Ownership-Record.");
      const record = recordRaw as CampaignOwnershipRecordV1,
        recordId = campaignLocalId(String(record.id)), recordType = identityType(record.recordType);
      if (recordType === "campaign" || recordType === "namespace")
        throw new Error("Reservierter Ownership-Recordtyp.");
      if (records.has(recordId)) throw new Error("Kollidierende Ownership-Identität.");
      const references = array(record.references, "Ownership-Referenzen").map((referenceRaw) => {
        if (!referenceRaw || typeof referenceRaw !== "object")
          throw new Error("Ungültige Ownership-Referenz.");
        const reference = referenceRaw as CampaignOwnershipReferenceV1;
        if (reference.scope !== "campaign-local" && reference.scope !== "shared")
          throw new Error("Unklassifizierte Ownership-Referenz.");
        const schema = referenceSchema(reference.schema);
        if (!schemas.includes(schema)) throw new Error("Nicht unterstütztes Referenzschema.");
        return Object.freeze({ id: referenceId(reference.id), scope: reference.scope, schema });
      }).sort((a, b) => `${a.scope}:${a.id}:${a.schema}`.localeCompare(`${b.scope}:${b.id}:${b.schema}`));
      let media: CampaignOwnershipRecordV1["media"] = null;
      if (record.media !== null) media = Object.freeze({
        metadataDigest: payloadDigest(record.media.metadataDigest),
        byteDigest: payloadDigest(record.media.byteDigest),
      });
      if ((recordType === "audio-source") !== (media !== null))
        throw new Error("AudioSource-Beleg ist unvollständig oder fremd.");
      const checked = Object.freeze({
        id: recordId, recordType, references: Object.freeze(references),
        payloadDigest: payloadDigest(record.payloadDigest), media,
      });
      records.set(recordId, checked);
      recordOwners.set(recordId, id);
      return checked;
    }).sort((a, b) => a.id.localeCompare(b.id));
    if ((checkedRecords.length === 0) !== owner.emptyConfirmed)
      throw new Error("Owner-Leerzustand ist nicht bestätigt.");
    return Object.freeze({
      ownerId: id,
      ownerRevision: token(owner.ownerRevision, "Ownerrevision"),
      schemaRevision: token(owner.schemaRevision, "Schemarevision"),
      snapshotRevision: token(owner.snapshotRevision, "Snapshotrevision"),
      availability: "confirmed" as const,
      emptyConfirmed: owner.emptyConfirmed,
      referenceSchemas: Object.freeze(schemas),
      source: Object.freeze({
        adapterType: token(owner.source?.adapterType, "Adaptertyp"),
        generation: token(owner.source?.generation, "Ownergeneration"),
      }),
      records: Object.freeze(checkedRecords),
    });
  }).sort((a, b) => a.ownerId.localeCompare(b.ownerId));
  if (!owners.length || new Set(owners.map((owner) => owner.ownerId)).size !== owners.length)
    throw new Error("Ownership-Owner sind unvollständig oder doppelt.");
  for (const record of records.values())
    for (const reference of record.references)
      if (reference.scope === "campaign-local" && !records.has(reference.id))
        throw new Error("Ownership-Referenz hängt frei.");
  const result = Object.freeze({
    version: 1 as const,
    registryId: token(value.registryId, "Registry-ID"),
    registryRevision: token(value.registryRevision, "Registry-Revision"),
    projectionDigest: payloadDigest(value.projectionDigest),
    context,
    owners: Object.freeze(owners),
  });
  return result;
}

export function campaignDomainOwnershipProjectionDigest(
  value: CampaignDomainOwnershipProjectionV1,
  digest: CampaignOwnershipDigest,
): Digest {
  const checked = campaignDomainOwnershipProjection(value), {
    projectionDigest: _projectionDigest,
    ...content
  } = checked;
  return checkedDigest(digest, content);
}

function checkedParticipant(value: CampaignCommandParticipantV1): CampaignCommandParticipantV1 {
  return Object.freeze({
    ownerId: ownerId(value.ownerId),
    ownerRevision: token(value.ownerRevision, "Ownerrevision"),
    schemaRevision: token(value.schemaRevision, "Schemarevision"),
    snapshotRevision: token(value.snapshotRevision, "Snapshotrevision"),
    beforeDigest: payloadDigest(value.beforeDigest),
    afterDigest: payloadDigest(value.afterDigest),
  });
}
function checkedClosure(value: readonly CampaignIdRemapV1[]): readonly CampaignIdRemapV1[] {
  const source = new Set<string>(), target = new Set<string>();
  const result = array(value, "ID-Closure").map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Ungültiger Closure-Eintrag.");
    const item = raw as CampaignIdRemapV1, entityType = item.entityType === "campaign" || item.entityType === "namespace"
      ? item.entityType : identityType(item.entityType), sourceId = referenceId(item.sourceId),
      targetId = referenceId(item.targetId);
    if (source.has(sourceId) || target.has(targetId)) throw new Error("Closure ist nicht eindeutig.");
    source.add(sourceId); target.add(targetId);
    return Object.freeze({ entityType, sourceId, targetId });
  });
  return Object.freeze(result);
}
function checkedSalvage(
  raw: CampaignSalvageProjectionV1,
  projection: CampaignDomainOwnershipProjectionV1,
  digest: CampaignOwnershipDigest,
): CampaignSalvageProjectionV1 {
  const records = new Map(projection.owners.flatMap((owner) => owner.records.map((record) => [record.id, record] as const))),
    survivors = checkedClosure(raw.survivors), survivorIds = new Set(survivors.map((item) => {
      if (item.entityType === "campaign" || item.entityType === "namespace")
        throw new Error("Salvage-Survivor muss ein Ownerrecord sein.");
      return campaignLocalId(item.sourceId);
    })),
    omissions = array(raw.omissions, "Salvage-Auslassungen").map((itemRaw) => {
      if (!itemRaw || typeof itemRaw !== "object") throw new Error("Ungültige Salvage-Auslassung.");
      const item = itemRaw as CampaignSalvageOmissionV1;
      return Object.freeze({ sourceId: campaignLocalId(String(item.sourceId)), reason: text(item.reason, "Auslassungsgrund"), impact: text(item.impact, "Auslassungsauswirkung") });
    }).sort((a, b) => a.sourceId.localeCompare(b.sourceId)), omissionIds = new Set(omissions.map((item) => item.sourceId)),
    quarantine = array(raw.quarantine, "Salvage-Quarantäne").map((itemRaw) => {
      if (!itemRaw || typeof itemRaw !== "object") throw new Error("Ungültiger Quarantänebeleg.");
      const item = itemRaw as CampaignSalvageQuarantineV1;
      if (item.retention !== "opaque" && item.retention !== "unknown-retained")
        throw new Error("Ungültige Quarantäneaufbewahrung.");
      return Object.freeze({
        sourceId: campaignLocalId(String(item.sourceId)), retention: item.retention,
        originalDigest: payloadDigest(item.originalDigest), reason: text(item.reason, "Quarantänegrund"),
        referenceIds: Object.freeze(array(item.referenceIds, "Quarantänereferenzen").map(referenceId).sort()),
      });
    }).sort((a, b) => a.sourceId.localeCompare(b.sourceId)), quarantineIds = new Set(quarantine.map((item) => item.sourceId));
  const partition = [...survivorIds, ...omissionIds, ...quarantineIds];
  if (new Set(partition).size !== partition.length || partition.length !== records.size ||
      partition.some((id) => !records.has(id)))
    throw new Error("Salvage-Partition ist nicht vollständig oder disjunkt.");
  for (const survivor of survivors) {
    const record = records.get(campaignLocalId(survivor.sourceId));
    if (!record) throw new Error("Salvage-Survivor ist unbekannt.");
    for (const reference of record.references)
      if (reference.scope === "campaign-local" && !survivorIds.has(campaignLocalId(reference.id)))
        throw new Error("Salvage-Survivor hängt frei.");
  }
  for (const item of quarantine) {
    const record = records.get(item.sourceId)!;
    if (item.originalDigest !== record.payloadDigest)
      throw new Error("Quarantänebeleg verliert den Originaldigest.");
    const expected = record.references.filter((reference) => reference.scope === "campaign-local")
      .map((reference) => reference.id).sort();
    if (JSON.stringify(expected) !== JSON.stringify(item.referenceIds))
      throw new Error("Quarantänebeleg verliert Referenzen.");
  }
  const survivorDigest = checkedDigest(digest, survivors), omissionDigest = checkedDigest(digest, omissions),
    quarantineDigest = checkedDigest(digest, quarantine);
  if (payloadDigest(raw.survivorDigest) !== survivorDigest ||
      payloadDigest(raw.omissionDigest) !== omissionDigest ||
      payloadDigest(raw.quarantineDigest) !== quarantineDigest)
    throw new Error("Salvage-Digest stimmt nicht mit der Closure überein.");
  return Object.freeze({
    decisionId: token(raw.decisionId, "Salvage-Entscheidung"),
    survivors, omissions: Object.freeze(omissions), quarantine: Object.freeze(quarantine),
    survivorDigest, omissionDigest, quarantineDigest,
  });
}

function baseStageFingerprint(input: CampaignMultiOwnerStageInputV1): unknown {
  return { commandId: input.commandId, receiptId: input.receiptId, kind: input.kind,
    participants: input.participants, closure: input.closure, salvage: input.salvage };
}
function checkedPublishOutcome(value: CampaignMultiOwnerPublishOutcome): CampaignMultiOwnerPublishOutcome {
  if (!value || typeof value !== "object" ||
      (value.kind !== "confirmed" && value.kind !== "conflict" && value.kind !== "outcome_unknown") ||
      Object.keys(value).length !== 1)
    throw new Error("Ungültiger Mehrowner-Publish-Ausgang.");
  return Object.freeze({ kind: value.kind });
}
function canonicalRemaps(value: readonly CampaignIdRemapV1[]): string {
  return JSON.stringify([...value].sort((a, b) =>
    `${a.sourceId}:${a.entityType}:${a.targetId}`.localeCompare(`${b.sourceId}:${b.entityType}:${b.targetId}`)));
}

export class CampaignOwnershipCoordinator {
  private readonly commands = new Map<CampaignCommandId, {
    readonly inputFingerprint: Digest;
    readonly envelope: CampaignMultiOwnerCommandEnvelopeV1;
    readonly projection: CampaignDomainOwnershipProjectionV1;
    publishStarted: boolean;
    terminal?: CampaignMultiOwnerPublishOutcome;
    running?: Promise<CampaignMultiOwnerPublishOutcome>;
  }>();

  constructor(
    private readonly registry: CampaignOwnerRegistryPort,
    private readonly publisher: CampaignMultiOwnerPublishPort,
    private readonly currentContext: () => CampaignContextProjection | null,
    private readonly digest: CampaignOwnershipDigest,
  ) {}

  async stage(input: CampaignMultiOwnerStageInputV1): Promise<CampaignMultiOwnerCommandEnvelopeV1> {
    const commandId = campaignCommandId(String(input.commandId)), receiptId = campaignReceiptId(String(input.receiptId)),
      inputSnapshot = structuredClone({ ...input, commandId, receiptId }) as CampaignMultiOwnerStageInputV1,
      inputFingerprint = checkedDigest(this.digest, baseStageFingerprint(inputSnapshot));
    const prior = this.commands.get(commandId);
    if (prior) {
      if (prior.inputFingerprint !== inputFingerprint) throw new Error("Command-ID wurde mit anderem Ownership-Auftrag wiederverwendet.");
      return prior.envelope;
    }
    const current = this.currentContext();
    if (!current) throw new Error("Kein aktiver Campaigncontext.");
    const context = checkedContext(current), read = await this.registry.read(context);
    if (read.kind !== "confirmed") throw new Error(`Owner-Registry ist ${read.kind}.`);
    const projection = campaignDomainOwnershipProjection(read.projection);
    if (!sameContext(context, projection.context)) throw new Error("Owner-Registry gehört zu einem anderen Campaigncontext.");
    if (campaignDomainOwnershipProjectionDigest(projection, this.digest) !== projection.projectionDigest)
      throw new Error("Ownership-Projektionsdigest ist stale.");
    const participants = array(inputSnapshot.participants, "Command-Teilnehmer").map((raw) =>
      checkedParticipant(raw as CampaignCommandParticipantV1)).sort((a, b) => a.ownerId.localeCompare(b.ownerId));
    if (participants.length !== projection.owners.length || new Set(participants.map((item) => item.ownerId)).size !== participants.length)
      throw new Error("Command-Teilnehmer sind unvollständig oder doppelt.");
    for (let index = 0; index < participants.length; index += 1) {
      const participant = participants[index]!, owner = projection.owners[index]!;
      if (participant.ownerId !== owner.ownerId || participant.ownerRevision !== owner.ownerRevision ||
          participant.schemaRevision !== owner.schemaRevision || participant.snapshotRevision !== owner.snapshotRevision)
        throw new Error("Command-Teilnehmer ist stale.");
    }
    const closure = checkedClosure(inputSnapshot.closure), allRecords = projection.owners.flatMap((owner) => owner.records),
      recordIds = allRecords.map((record) => record.id), recordsById = new Map(allRecords.map((record) => [record.id, record])),
      mapped = new Set(closure.filter((item) => item.entityType !== "campaign" && item.entityType !== "namespace").map((item) => item.sourceId));
    const campaignMappings = closure.filter((item) => item.entityType === "campaign"),
      namespaceMappings = closure.filter((item) => item.entityType === "namespace");
    const targetCampaignId = campaignId(campaignMappings[0]?.targetId ?? ""),
      targetNamespace = campaignNamespace(namespaceMappings[0]?.targetId ?? ""),
      keepsIdentity = inputSnapshot.kind === "spatial-write";
    if (campaignMappings.length !== 1 || namespaceMappings.length !== 1 ||
        campaignMappings[0]!.sourceId !== context.campaignId || namespaceMappings[0]!.sourceId !== context.namespace ||
        (keepsIdentity ? targetCampaignId !== context.campaignId || targetNamespace !== context.namespace
          : targetCampaignId === context.campaignId || targetNamespace === context.namespace))
      throw new Error("Campaign-/Namespace-Closure ist ungültig.");
    const sourceRecordIds = new Set(recordIds), forbiddenTargets = new Set<string>([
      context.campaignId, context.namespace, ...recordIds,
      ...allRecords.flatMap((record) => record.references
        .filter((reference) => reference.scope === "shared").map((reference) => reference.id)),
    ]);
    if (!keepsIdentity && closure.some((item) => forbiddenTargets.has(item.targetId)))
      throw new Error("Remapziel verwendet eine Sourceidentität wieder.");
    for (const item of closure) {
      if (item.entityType === "campaign" || item.entityType === "namespace") continue;
      const record = recordsById.get(campaignLocalId(item.sourceId));
      if (!record || record.recordType !== item.entityType)
        throw new Error("Closure verletzt die Record-ID-Typ-Bindung.");
      const targetId = campaignLocalId(item.targetId);
      if (keepsIdentity ? targetId !== record.id : sourceRecordIds.has(targetId))
        throw new Error("Closure-Ziel ist für die Commandart nicht unabhängig.");
    }
    let salvage: CampaignSalvageProjectionV1 | null = null;
    if (inputSnapshot.kind === "salvage-import") {
      if (!inputSnapshot.salvage) throw new Error("Salvage-Projektion fehlt.");
      salvage = checkedSalvage(inputSnapshot.salvage, projection, this.digest);
      const commandSurvivors = closure.filter((item) => item.entityType !== "campaign" && item.entityType !== "namespace");
      if (canonicalRemaps(commandSurvivors) !== canonicalRemaps(salvage.survivors))
        throw new Error("Salvage-Closure stimmt nicht mit Survivors überein.");
    } else {
      if (inputSnapshot.salvage) throw new Error("Complete-/Spatial-Command darf kein Salvage tragen.");
      if (JSON.stringify([...mapped].sort()) !== JSON.stringify([...recordIds].sort()))
        throw new Error("Complete-Closure ist unvollständig.");
    }
    const withoutFingerprint = {
      version: 1 as const, commandId, receiptId, kind: inputSnapshot.kind, context,
      registryId: projection.registryId, registryRevision: projection.registryRevision,
      projectionDigest: projection.projectionDigest, participants: Object.freeze(participants), closure, salvage,
    }, envelope = Object.freeze({ ...withoutFingerprint, fingerprint: checkedDigest(this.digest, withoutFingerprint) });
    this.commands.set(commandId, { inputFingerprint, envelope, projection, publishStarted: false });
    return envelope;
  }

  publish(commandIdRaw: CampaignCommandId): Promise<CampaignMultiOwnerPublishOutcome> {
    const commandId = campaignCommandId(String(commandIdRaw)), command = this.commands.get(commandId);
    if (!command) return Promise.reject(new Error("Ownership-Command ist unbekannt."));
    if (command.terminal) return Promise.resolve(command.terminal);
    if (command.running) return command.running;
    command.running = (command.publishStarted ? this.resolveStatus(command) : this.publishOnce(command))
      .finally(() => { command.running = undefined; });
    return command.running;
  }

  private terminal(
    command: { terminal?: CampaignMultiOwnerPublishOutcome },
    outcome: CampaignMultiOwnerPublishOutcome,
  ): CampaignMultiOwnerPublishOutcome {
    if (outcome.kind === "confirmed" || outcome.kind === "conflict") command.terminal = outcome;
    return outcome;
  }

  private async publishOnce(command: {
    readonly envelope: CampaignMultiOwnerCommandEnvelopeV1;
    readonly projection: CampaignDomainOwnershipProjectionV1;
    publishStarted: boolean;
    terminal?: CampaignMultiOwnerPublishOutcome;
  }): Promise<CampaignMultiOwnerPublishOutcome> {
    const { envelope, projection } = command;
    const current = this.currentContext();
    if (!current || !sameContext(current, envelope.context))
      return this.terminal(command, Object.freeze({ kind: "conflict" }));
    const verified = await this.registry.verify(projection);
    if (verified.kind === "stale") return this.terminal(command, Object.freeze({ kind: "conflict" }));
    if (verified.kind !== "current") return Object.freeze({ kind: "outcome_unknown" });
    const afterVerify = this.currentContext();
    if (!afterVerify || !sameContext(afterVerify, envelope.context))
      return this.terminal(command, Object.freeze({ kind: "conflict" }));
    const request = Object.freeze({
      version: 1 as const, envelope,
      preconditions: Object.freeze({
        context: envelope.context, registryId: envelope.registryId,
        registryRevision: envelope.registryRevision, projectionDigest: envelope.projectionDigest,
        participants: envelope.participants,
      }),
    });
    command.publishStarted = true;
    return this.terminal(command, checkedPublishOutcome(await this.publisher.publish(request)));
  }

  private async resolveStatus(command: {
    readonly envelope: CampaignMultiOwnerCommandEnvelopeV1;
    terminal?: CampaignMultiOwnerPublishOutcome;
  }): Promise<CampaignMultiOwnerPublishOutcome> {
    const outcome = checkedPublishOutcome(await this.publisher.status(
      command.envelope.commandId,
      command.envelope.receiptId,
    ));
    return this.terminal(command, outcome);
  }

  status(commandIdRaw: CampaignCommandId): Promise<CampaignMultiOwnerPublishOutcome> {
    const commandId = campaignCommandId(String(commandIdRaw)), command = this.commands.get(commandId);
    if (!command) return Promise.reject(new Error("Ownership-Command ist unbekannt."));
    if (command.terminal) return Promise.resolve(command.terminal);
    if (!command.publishStarted) return Promise.resolve(Object.freeze({ kind: "outcome_unknown" }));
    if (command.running) return command.running;
    command.running = this.resolveStatus(command).finally(() => { command.running = undefined; });
    return command.running;
  }
}
