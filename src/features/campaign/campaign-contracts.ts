type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type CampaignId = Brand<string, "CampaignId">;
export type CampaignLocalId = Brand<string, "CampaignLocalId">;
export type CampaignNamespace = Brand<string, "CampaignNamespace">;
export type CampaignContextToken = Brand<string, "CampaignContextToken">;
export type CampaignCommandId = Brand<string, "CampaignCommandId">;
export type CampaignReceiptId = Brand<string, "CampaignReceiptId">;
export type CampaignRevision = Brand<number, "CampaignRevision">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const OWNER = /^[a-z][a-z0-9.-]{0,63}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

function brandedUuid<Name extends string>(value: string, label: string): Brand<string, Name> {
  if (typeof value !== "string" || !UUID.test(value))
    throw new Error(`Ungültige ${label}.`);
  return value as Brand<string, Name>;
}
function brandedToken<Name extends string>(value: string, label: string): Brand<string, Name> {
  if (typeof value !== "string" || !TOKEN.test(value))
    throw new Error(`Ungültige ${label}.`);
  return value as Brand<string, Name>;
}

export const campaignId = (value: string): CampaignId =>
  brandedUuid<"CampaignId">(value, "Campaign-ID");
export const campaignLocalId = (value: string): CampaignLocalId =>
  brandedUuid<"CampaignLocalId">(value, "kampagnenlokale ID");
export const campaignNamespace = (value: string): CampaignNamespace =>
  brandedUuid<"CampaignNamespace">(value, "Campaign-Namespace");
export const campaignContextToken = (value: string): CampaignContextToken =>
  brandedToken<"CampaignContextToken">(value, "Context-Identität");
export const campaignCommandId = (value: string): CampaignCommandId =>
  brandedUuid<"CampaignCommandId">(value, "Command-ID");
export const campaignReceiptId = (value: string): CampaignReceiptId =>
  brandedUuid<"CampaignReceiptId">(value, "Receipt-ID");
export function campaignRevision(value: number): CampaignRevision {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("Ungültige Campaign-Revision.");
  return value as CampaignRevision;
}

export type CampaignLifecycleState = "active" | "trashed";
export interface CampaignSnapshotV1 {
  readonly schemaVersion: 1;
  readonly campaignId: CampaignId;
  readonly revision: CampaignRevision;
  readonly name: string;
  readonly namespace: CampaignNamespace;
  readonly lifecycle: CampaignLifecycleState;
}
export interface CampaignContextProjection extends CampaignSnapshotV1 {
  readonly contextToken: CampaignContextToken;
}

function exactKeys(value: object, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
    throw new Error(`Ungültiger ${label}.`);
}
function campaignName(value: unknown): string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > 160)
    throw new Error("Ungültiger Campaign-Name.");
  return value;
}
export function campaignSnapshot(value: unknown): CampaignSnapshotV1 {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Ungültiger Campaign-Snapshot.");
  exactKeys(value, ["schemaVersion", "campaignId", "revision", "name", "namespace", "lifecycle"], "Campaign-Snapshot");
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1 || !["active", "trashed"].includes(String(raw.lifecycle)))
    throw new Error("Ungültiger Campaign-Snapshot.");
  return Object.freeze({
    schemaVersion: 1,
    campaignId: campaignId(String(raw.campaignId)),
    revision: campaignRevision(Number(raw.revision)),
    name: campaignName(raw.name),
    namespace: campaignNamespace(String(raw.namespace)),
    lifecycle: raw.lifecycle as CampaignLifecycleState,
  });
}
export function campaignContext(
  snapshot: CampaignSnapshotV1,
  contextToken: CampaignContextToken,
): CampaignContextProjection {
  return Object.freeze({ ...campaignSnapshot(snapshot), contextToken });
}

export type CampaignCommandStatus =
  | "staged"
  | "validated"
  | "published"
  | "verified"
  | "finalized"
  | "cancelled_before_publish"
  | "conflict"
  | "outcome_unknown";
export type CampaignCommandKind =
  | "create"
  | "rename"
  | "open"
  | "switch"
  | "copy-plan"
  | "complete-import-stage";
export interface CampaignReceipt {
  readonly commandId: CampaignCommandId;
  readonly receiptId: CampaignReceiptId;
  readonly kind: CampaignCommandKind;
  readonly status: CampaignCommandStatus;
  readonly sourceCampaignId: CampaignId | null;
  readonly targetCampaignId: CampaignId | null;
  readonly expectedRevision: CampaignRevision | null;
  readonly contextToken: CampaignContextToken | null;
}
export function campaignReceipt(value: CampaignReceipt): CampaignReceipt {
  return Object.freeze({ ...value });
}

export type OwnerAvailability = "confirmed" | "unavailable" | "unknown";
export type IdentityScope = "campaign-local" | "shared";
export interface CampaignIdentityReferenceV1 {
  readonly id: string;
  readonly scope: IdentityScope;
  readonly schema: string;
}
export interface CampaignIdentityRecordV1 {
  readonly id: CampaignLocalId;
  readonly recordType: string;
  readonly references: readonly CampaignIdentityReferenceV1[];
}
export interface CampaignPayloadEvidenceV1 {
  readonly recordId: CampaignLocalId;
  readonly digest: string;
  readonly referenceSchema: string;
  readonly media: {
    readonly metadataDigest: string;
    readonly byteDigest: string;
  } | null;
}
export interface CampaignOwnerInventoryV1 {
  readonly version: 1;
  readonly sourceCampaignId: CampaignId;
  readonly ownerId: string;
  readonly ownerRevision: string;
  readonly schemaRevision: string;
  readonly snapshotRevision: string;
  readonly referenceSchemas: readonly string[];
  readonly availability: OwnerAvailability;
  readonly emptyConfirmed: boolean;
  readonly recordCount: number;
  readonly records: readonly CampaignIdentityRecordV1[];
  readonly payloadEvidence: readonly CampaignPayloadEvidenceV1[];
}
export interface CampaignExpectedOwnerV1 {
  readonly ownerId: string;
  readonly ownerRevision: string;
  readonly schemaRevision: string;
  readonly snapshotRevision: string;
  readonly referenceSchemas: readonly string[];
}
export interface CampaignDeliveryV1 {
  readonly version: 1;
  readonly sourceCampaignId: CampaignId;
  readonly sourceNamespace: CampaignNamespace;
  readonly expectedOwners: readonly CampaignExpectedOwnerV1[];
  readonly inventories: readonly CampaignOwnerInventoryV1[];
}
export interface CampaignIdRemapV1 {
  readonly entityType: "campaign" | "namespace" | string;
  readonly sourceId: string;
  readonly targetId: string;
}
export interface CampaignRemapPlanV1 {
  readonly version: 1;
  readonly sourceCampaignId: CampaignId;
  readonly targetCampaignId: CampaignId;
  readonly sourceNamespace: CampaignNamespace;
  readonly targetNamespace: CampaignNamespace;
  readonly ownerIds: readonly string[];
  readonly closure: readonly CampaignIdRemapV1[];
  readonly sharedReferences: readonly string[];
}
export interface CampaignParticipantStageV1 {
  readonly version: 1;
  readonly ownerId: "campaign-data";
  readonly plan: CampaignRemapPlanV1;
  readonly snapshot: CampaignSnapshotV1;
  readonly visible: false;
}

export function ownerId(value: string): string {
  if (!OWNER.test(value)) throw new Error("Ungültige Owner-ID.");
  return value;
}
export function revisionToken(value: string, label: string): string {
  if (!TOKEN.test(value)) throw new Error(`Ungültige ${label}.`);
  return value;
}
export function referenceSchema(value: string): string {
  return revisionToken(value, "Referenzschema");
}
export function payloadDigest(value: string): string {
  if (!DIGEST.test(value)) throw new Error("Ungültiger Payload-Beleg.");
  return value;
}
export function identityType(value: string): string {
  if (!OWNER.test(value)) throw new Error("Ungültiger Identitätstyp.");
  return value;
}

export function sameSnapshot(a: CampaignSnapshotV1, b: CampaignSnapshotV1): boolean {
  return a.schemaVersion === b.schemaVersion && a.campaignId === b.campaignId &&
    a.revision === b.revision && a.name === b.name && a.namespace === b.namespace &&
    a.lifecycle === b.lifecycle;
}
