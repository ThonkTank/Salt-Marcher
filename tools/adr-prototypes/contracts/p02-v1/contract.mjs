import { createHash } from "node:crypto";

export const SCHEMA_VERSION = "p02-v1";
export const OUTCOMES = Object.freeze([
  "not_applied",
  "applied",
  "already_applied",
  "rejected",
  "revision_conflict",
  "outcome_unknown",
]);

export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const commandDigest = (command) => sha256(canonical(command));

const exact = (value, keys, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some((key) => !(key in value)))
    throw new Error(`${label} has an invalid shape`);
};
const text = (value, label, min = 1, max = 512) => {
  if (typeof value !== "string" || value.length < min || value.length > max || /[\u0000]/u.test(value))
    throw new Error(`${label} is invalid`);
};
const token = (value, label) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{24,128}$/.test(value))
    throw new Error(`${label} must be an opaque token`);
};
const digest = (value, label) => {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error(`${label} must be a SHA-256 digest`);
};
const revision = (value, label, nullable = false) => {
  if (nullable && value === null) return;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} is invalid`);
};
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};

export function validateCommand(value) {
  exact(value, ["kind", "campaignId", "objectId", "newName", "historyFact"], "command");
  if (value.kind !== "rename_campaign_object") throw new Error("unsupported command kind");
  for (const key of ["campaignId", "objectId"]) token(value[key], key);
  text(value.newName, "newName", 1, 256);
  text(value.historyFact, "historyFact", 1, 1024);
  return freeze(structuredClone(value));
}

export function validateRequest(value) {
  exact(value, ["schemaVersion", "commandId", "commandDigest", "expectedRevision", "command"], "request");
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("unsupported request schema");
  token(value.commandId, "commandId");
  digest(value.commandDigest, "commandDigest");
  revision(value.expectedRevision, "expectedRevision");
  const command = validateCommand(value.command);
  if (commandDigest(command) !== value.commandDigest) throw new Error("commandDigest does not bind command");
  return freeze({ ...structuredClone(value), command });
}

export function validateReconcileRequest(value) {
  exact(value, ["schemaVersion", "commandId", "commandDigest", "expectedRevision"], "reconcile request");
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("unsupported reconcile schema");
  token(value.commandId, "commandId");
  digest(value.commandDigest, "commandDigest");
  revision(value.expectedRevision, "expectedRevision");
  return freeze(structuredClone(value));
}

export const reconciliationFor = (request) => validateReconcileRequest({
  schemaVersion: request.schemaVersion,
  commandId: request.commandId,
  commandDigest: request.commandDigest,
  expectedRevision: request.expectedRevision,
});

export function receiptDigest(value) {
  const { receiptDigest: _ignored, ...bound } = value;
  return sha256(canonical(bound));
}

export function validateReceipt(value) {
  exact(value, [
    "schemaVersion", "commandId", "commandDigest", "expectedRevision", "committedRevision",
    "campaignId", "objectId", "beforeName", "afterName", "historyFact", "receiptDigest",
  ], "receipt");
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("unsupported receipt schema");
  token(value.commandId, "receipt.commandId");
  digest(value.commandDigest, "receipt.commandDigest");
  revision(value.expectedRevision, "receipt.expectedRevision");
  revision(value.committedRevision, "receipt.committedRevision");
  if (value.committedRevision !== value.expectedRevision + 1) throw new Error("receipt revision is not consecutive");
  token(value.campaignId, "receipt.campaignId");
  token(value.objectId, "receipt.objectId");
  text(value.beforeName, "receipt.beforeName", 1, 256);
  text(value.afterName, "receipt.afterName", 1, 256);
  text(value.historyFact, "receipt.historyFact", 1, 1024);
  digest(value.receiptDigest, "receipt.receiptDigest");
  if (receiptDigest(value) !== value.receiptDigest) throw new Error("receiptDigest does not bind receipt");
  return freeze(structuredClone(value));
}

export function validateResult(value) {
  exact(value, [
    "schemaVersion", "outcome", "commandId", "commandDigest", "expectedRevision",
    "currentRevision", "receipt", "reason",
  ], "result");
  if (value.schemaVersion !== SCHEMA_VERSION || !OUTCOMES.includes(value.outcome))
    throw new Error("unsupported result");
  token(value.commandId, "result.commandId");
  digest(value.commandDigest, "result.commandDigest");
  revision(value.expectedRevision, "result.expectedRevision");
  revision(value.currentRevision, "result.currentRevision", value.outcome === "outcome_unknown");
  if (["applied", "already_applied"].includes(value.outcome)) validateReceipt(value.receipt);
  else if (value.receipt !== null) throw new Error("non-applied result must not carry a receipt");
  if (value.reason !== null) text(value.reason, "result.reason", 1, 512);
  if (value.outcome === "outcome_unknown" && value.currentRevision !== null)
    throw new Error("unknown outcome must not imply a revision");
  if (["applied", "already_applied"].includes(value.outcome)) {
    for (const key of ["commandId", "commandDigest", "expectedRevision"])
      if (value.receipt[key] !== value[key]) throw new Error(`result receipt does not bind ${key}`);
    if (value.currentRevision < value.receipt.committedRevision)
      throw new Error("result revision predates receipt");
  }
  if (value.outcome === "not_applied" && value.currentRevision !== value.expectedRevision)
    throw new Error("not_applied requires the expected revision");
  if (value.outcome === "revision_conflict" && value.currentRevision === value.expectedRevision)
    throw new Error("revision_conflict requires a different revision");
  if (["applied", "already_applied", "not_applied"].includes(value.outcome) && value.reason !== null)
    throw new Error(`${value.outcome} must not carry a reason`);
  if (["rejected", "revision_conflict", "outcome_unknown"].includes(value.outcome) && value.reason === null)
    throw new Error(`${value.outcome} requires a reason`);
  return freeze(structuredClone(value));
}

export function validateExecuteResult(value) {
  const validated = validateResult(value);
  if (validated.outcome === "not_applied") throw new Error("execute cannot return not_applied");
  return validated;
}

export function validateReconcileResult(value) {
  const validated = validateResult(value);
  if (validated.outcome === "already_applied") throw new Error("reconcile cannot return already_applied");
  return validated;
}
