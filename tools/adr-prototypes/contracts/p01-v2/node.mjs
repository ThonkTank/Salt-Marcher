import crypto from "node:crypto";
import { canonical, deepFreeze } from "./contract.mjs";

export function digest(value) {
  return crypto.createHash("sha256").update(canonical(value)).digest("hex");
}

export function receiptRecord(fields) {
  return deepFreeze({ schemaVersion: "p01-v2", ...structuredClone(fields) });
}
