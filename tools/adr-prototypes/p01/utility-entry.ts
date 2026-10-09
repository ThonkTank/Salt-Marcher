import crypto from "node:crypto";
import { MapRepository } from "../../../src/persistence";
import type { Entity } from "../../../src/model";
import {
  SCHEMA_VERSION,
  validateInvalidation,
  validateRequest,
  validateResponse,
} from "../contracts/p01-v2/contract.mjs";
import { digest } from "../contracts/p01-v2/node.mjs";
import { NativeFileStore } from "./native-client";

const [root, helper, utilityToken, helperToken] = process.argv.slice(2);
if (!root || !helper || !utilityToken || !helperToken) throw new Error("missing utility arguments");
const parentPort = (process as typeof process & { parentPort?: {
  postMessage(value: unknown): void;
  on(name: "message", listener: (event: { data: unknown }) => void): void;
} }).parentPort;
if (!parentPort) throw new Error("utility process has no parent port");

const store = new NativeFileStore(helper, root, helperToken);
const utilityStartedAt = new Date().toISOString();
const sessions = new Map<string, { repository: MapRepository; session: import("../../../src/session").Session; mapId: string }>();
const subscriptions = new Map<string, string>();

function post(value: unknown): void { parentPort!.postMessage(value); }
function result(session: import("../../../src/session").Session) {
  return { schemaVersion: SCHEMA_VERSION, revision: session.revision, digest: digest(session.document()) };
}

async function execute(raw: unknown) {
  const request = validateRequest(raw);
  let operationResult: unknown;
  if (request.operation === "openMap") {
    if (request.payload.mapId !== "fixture") throw new Error("unknown map id");
    const repository = new MapRepository(store, "map.dungeon");
    const session = await repository.open();
    if (session.revision !== request.payload.expectedRevision) throw new Error("revision conflict");
    const token = crypto.randomBytes(24).toString("base64url");
    sessions.set(token, { repository, session, mapId: request.payload.mapId });
    operationResult = {
      handle: { schemaVersion: SCHEMA_VERSION, token, mapId: request.payload.mapId, revision: session.revision },
      snapshot: { schemaVersion: SCHEMA_VERSION, mapId: request.payload.mapId,
        revision: session.revision, digest: digest(session.document()), document: session.document() },
    };
  } else {
    const token = request.payload.mapHandle.token;
    const opened = sessions.get(token);
    if (!opened || opened.mapId !== request.payload.mapHandle.mapId) throw new Error("invalid map handle");
    if (request.operation === "executeMapCommand") {
      if (opened.session.revision !== request.payload.expectedRevision) throw new Error("revision conflict");
      const command = request.payload.command;
      if (command.kind === "moveEntity") {
        const before = opened.session.entities.get(command.entityId) as Entity | undefined;
        if (!before || !("x" in before) || !("y" in before) ||
            typeof before.x !== "number" || typeof before.y !== "number") throw new Error("entity is not movable");
        const after = { ...before, x: before.x + command.dx, y: before.y + command.dy } as Entity;
        opened.session.execute({ label: "H02 move", entities: [{ id: before.id, before, after }] });
      } else if (command.kind === "undo") opened.session.undo();
      else opened.session.redo();
      operationResult = result(opened.session);
      for (const [subscriptionId, subscribedToken] of subscriptions)
        if (subscribedToken === token) post({ kind: "invalidation", value: validateInvalidation({
          schemaVersion: SCHEMA_VERSION, subscriptionId, mapId: opened.mapId,
          revision: opened.session.revision, digest: digest(opened.session.document()),
        }) });
    } else if (request.operation === "saveMap") {
      if (opened.session.revision !== request.payload.expectedRevision) throw new Error("revision conflict");
      await opened.repository.save(opened.session);
      operationResult = result(opened.session);
    } else if (request.operation === "readAsset") {
      const data = "H02 bounded asset";
      const hash = crypto.createHash("sha256").update(data).digest("hex");
      if (request.payload.assetId !== "h02-manifest" || request.payload.expectedHash !== hash)
        throw new Error("asset mismatch");
      operationResult = { schemaVersion: SCHEMA_VERSION, assetId: request.payload.assetId, hash, data };
    } else if (request.operation === "subscribeMapInvalidation") {
      if (request.payload.revision !== opened.session.revision) throw new Error("revision conflict");
      const subscriptionId = crypto.randomBytes(24).toString("base64url");
      subscriptions.set(subscriptionId, token);
      operationResult = { subscriptionId };
    }
  }
  return validateResponse({ schemaVersion: SCHEMA_VERSION, operation: request.operation,
    requestId: request.requestId, ok: true, result: operationResult });
}

void store.ready.then(() => {
post({ kind: "ready", utilityPid: process.pid, utilityPpid: process.ppid,
  helperPid: store.pid, helperPpid: process.pid, utilityToken, helperToken,
  utilityStartedAt, helperStartedAt: store.startedAt });
parentPort.on("message", (event) => {
  const message = event.data as { kind?: string; request?: unknown };
  if (message?.kind === "shutdown") {
    void store.close().then((helperExitCode) => {
      post({ kind: "shutdown", helperExitCode });
      process.exit(0);
    });
    return;
  }
  if (message?.kind !== "request") return;
  void execute(message.request).then(
    (response) => post({ kind: "response", response }),
    (error) => {
      try {
        const request = validateRequest(message.request);
        post({ kind: "response", response: validateResponse({ schemaVersion: SCHEMA_VERSION,
          operation: request.operation, requestId: request.requestId, ok: false,
          error: String(error instanceof Error ? error.message : error).slice(0, 512) }) });
      } catch (validationError) {
        post({ kind: "boundaryError", error: String(validationError) });
      }
    },
  );
});
});
