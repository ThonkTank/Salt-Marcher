import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignCommandId,
  campaignContextToken,
  campaignId,
  campaignNamespace,
  campaignReceiptId,
  campaignRevision,
  campaignSnapshot,
  type CampaignCommandId,
  type CampaignId,
  type CampaignSnapshotV1,
} from "../../src/features/campaign/campaign-contracts";
import {
  CampaignLifecycle,
  type CampaignLifecyclePort,
  type CampaignMutationRequest,
  type CampaignPortOutcome,
} from "../../src/features/campaign/campaign-lifecycle";

const ids = {
  a: campaignId("00000000-0000-4000-8000-000000000001"),
  b: campaignId("00000000-0000-4000-8000-000000000011"),
  c: campaignId("00000000-0000-4000-8000-000000000021"),
  nsA: campaignNamespace("00000000-0000-4000-8000-000000000002"),
  nsB: campaignNamespace("00000000-0000-4000-8000-000000000012"),
};
const snapshot = (id: CampaignId, namespace: ReturnType<typeof campaignNamespace>, name: string) =>
  campaignSnapshot({ schemaVersion: 1, campaignId: id, revision: campaignRevision(1), name, namespace, lifecycle: "active" });
const command = (n: number): CampaignCommandId =>
  campaignCommandId(`00000000-0000-4000-8001-${String(n).padStart(12, "0")}`);

class Port implements CampaignLifecyclePort {
  readonly snapshots = new Map<CampaignId, CampaignSnapshotV1>();
  readonly publishes: CampaignMutationRequest[] = [];
  readonly reads: CampaignId[] = [];
  publishMode: "confirm" | "unknown" | "conflict" | "defer" = "confirm";
  readGates = new Map<CampaignId, Promise<CampaignSnapshotV1 | null>>();
  statusOutcome: CampaignPortOutcome = { kind: "outcome_unknown" };
  resolvePublish?: (outcome: CampaignPortOutcome) => void;
  async read(id: CampaignId): Promise<CampaignSnapshotV1 | null> {
    this.reads.push(id);
    return this.readGates.get(id) ?? this.snapshots.get(id) ?? null;
  }
  publish(request: CampaignMutationRequest): Promise<CampaignPortOutcome> {
    this.publishes.push(request);
    if (this.publishMode === "conflict") return Promise.resolve({ kind: "conflict" });
    const before = this.snapshots.get(request.after.campaignId) ?? null;
    if ((request.before === null) !== (before === null) ||
        request.before && before && JSON.stringify(request.before) !== JSON.stringify(before))
      return Promise.resolve({ kind: "conflict" });
    this.snapshots.set(request.after.campaignId, request.after);
    if (this.publishMode === "unknown") return Promise.resolve({ kind: "outcome_unknown" });
    if (this.publishMode === "defer")
      return new Promise((resolve) => { this.resolvePublish = resolve; });
    return Promise.resolve({ kind: "confirmed", snapshot: request.after });
  }
  async status(): Promise<CampaignPortOutcome> {
    return this.statusOutcome;
  }
}
function lifecycle(port = new Port()) {
  let campaignIndex = 0, namespaceIndex = 0, tokenIndex = 0, receiptIndex = 0;
  const service = new CampaignLifecycle(port, {
    campaignId: () => [ids.a, ids.b, ids.c][campaignIndex++]!,
    namespace: () => campaignNamespace(`00000000-0000-4000-8002-${String(++namespaceIndex).padStart(12, "0")}`),
    contextToken: () => campaignContextToken(`context:${++tokenIndex}`),
    receiptId: () => campaignReceiptId(`00000000-0000-4000-8003-${String(++receiptIndex).padStart(12, "0")}`),
  });
  return { service, port };
}

test("create assigns identities once and same-command retry publishes exactly once", async () => {
  const { service, port } = lifecycle(), id = command(1);
  const staged = service.stageCreate(id, "Nordmark"), retry = service.stageCreate(id, "Nordmark");
  assert.strictEqual(staged, retry);
  assert.equal(staged.targetCampaignId, ids.a);
  const first = service.execute(id), second = service.execute(id);
  assert.strictEqual(first, second);
  assert.equal((await first).status, "finalized");
  assert.equal(port.publishes.length, 1);
  assert.equal((await service.execute(id)).status, "finalized");
  assert.equal(port.publishes.length, 1);
  assert.throws(() => service.stageCreate(id, "Anderer Name"), /anderem Auftrag/);
});

test("cancel before publish preserves truth while publish-wins cannot report cancellation", async () => {
  const first = lifecycle(), before = new Map(first.port.snapshots), id = command(2);
  first.service.stageCreate(id, "Abbruch");
  assert.equal(first.service.cancel(id), true);
  assert.equal((await first.service.execute(id)).status, "cancelled_before_publish");
  assert.deepEqual(first.port.snapshots, before);
  assert.equal(first.port.publishes.length, 0);

  const second = lifecycle();
  second.port.publishMode = "defer";
  second.service.stageCreate(command(3), "Publish gewinnt");
  const pending = second.service.execute(command(3));
  assert.equal(second.service.cancel(command(3)), false);
  await Promise.resolve();
  assert.equal(second.port.publishes.length, 1);
  second.port.resolvePublish!({ kind: "confirmed", snapshot: second.port.publishes[0]!.after });
  assert.equal((await pending).status, "finalized");
  assert.equal(second.port.publishes.length, 1);
});

test("lost acknowledgement resolves through the original command and receipt without replacement IDs", async () => {
  const { service, port } = lifecycle(), id = command(4);
  port.publishMode = "unknown";
  const staged = service.stageCreate(id, "Unbekannter Ausgang"), unknown = await service.execute(id);
  assert.equal(unknown.status, "outcome_unknown");
  assert.equal(port.publishes.length, 1);
  const assigned = port.publishes[0]!.after;
  port.statusOutcome = { kind: "confirmed", snapshot: assigned };
  const resolved = await service.query(id);
  assert.equal(resolved.status, "finalized");
  assert.equal(resolved.receiptId, staged.receiptId);
  assert.equal(resolved.targetCampaignId, staged.targetCampaignId);
  assert.equal(port.publishes.length, 1);
  assert.equal((await service.execute(id)).status, "finalized");
  assert.equal(port.publishes.length, 1);
});

test("A to B to A reopen retains campaign identity but creates isolated activation tokens", async () => {
  const { service, port } = lifecycle();
  port.snapshots.set(ids.a, snapshot(ids.a, ids.nsA, "A"));
  port.snapshots.set(ids.b, snapshot(ids.b, ids.nsB, "B"));
  const a1 = await service.activate(command(10), ids.a), b = await service.activate(command(11), ids.b),
    a2 = await service.activate(command(12), ids.a);
  assert.deepEqual([a1.applied, b.applied, a2.applied], [true, true, true]);
  assert.equal(a1.context!.campaignId, a2.context!.campaignId);
  assert.equal(a1.context!.namespace, a2.context!.namespace);
  assert.notEqual(a1.context!.contextToken, a2.context!.contextToken);
  assert.notEqual(b.context!.contextToken, a2.context!.contextToken);
  assert.equal(service.context, a2.context);
  assert.deepEqual(port.reads, [ids.a, ids.b, ids.a]);
  assert.strictEqual(await service.activate(command(12), ids.a), a2);
  assert.deepEqual(port.reads, [ids.a, ids.b, ids.a]);
});

test("late open and stale A1 write cannot replace or mutate a newer B/A2 context", async () => {
  const { service, port } = lifecycle();
  const a = snapshot(ids.a, ids.nsA, "A"), b = snapshot(ids.b, ids.nsB, "B");
  port.snapshots.set(ids.a, a);
  port.snapshots.set(ids.b, b);
  let release!: (value: CampaignSnapshotV1 | null) => void;
  port.readGates.set(ids.a, new Promise((resolve) => { release = resolve; }));
  const lateA = service.activate(command(20), ids.a);
  const activeB = await service.activate(command(21), ids.b);
  release(a);
  assert.equal((await lateA).applied, false);
  assert.equal(service.context, activeB.context);

  port.readGates.delete(ids.a);
  const activeA = await service.activate(command(22), ids.a);
  service.stageRename(command(23), activeA.context!, "A alt");
  const activeB2 = await service.activate(command(24), ids.b);
  assert.equal((await service.execute(command(23))).status, "conflict");
  assert.equal(port.publishes.length, 0);
  assert.equal(service.context, activeB2.context);
  assert.equal(port.snapshots.get(ids.a)!.name, "A");
});

test("late confirmed rename updates its campaign but never overwrites a newer active context", async () => {
  const { service, port } = lifecycle();
  port.snapshots.set(ids.a, snapshot(ids.a, ids.nsA, "A"));
  port.snapshots.set(ids.b, snapshot(ids.b, ids.nsB, "B"));
  const activeA = await service.activate(command(30), ids.a);
  service.stageRename(command(31), activeA.context!, "A neu");
  port.publishMode = "defer";
  const rename = service.execute(command(31));
  const activeB = await service.activate(command(32), ids.b);
  port.resolvePublish!({ kind: "confirmed", snapshot: port.publishes[0]!.after });
  assert.equal((await rename).status, "finalized");
  assert.equal(port.snapshots.get(ids.a)!.name, "A neu");
  assert.equal(service.context, activeB.context);
});

test("snapshots and contexts reject malformed values and expose no session initializer", async () => {
  const { service, port } = lifecycle();
  const raw = snapshot(ids.a, ids.nsA, "Immutable");
  port.snapshots.set(ids.a, raw);
  const active = await service.activate(command(40), ids.a);
  assert.equal(Object.isFrozen(active.context), true);
  assert.equal("liveSession" in active.context!, false);
  assert.equal("initialize" in service, false);
  assert.throws(() => campaignSnapshot({ ...raw, revision: 0 }), /Revision/);
  assert.throws(() => campaignSnapshot({ ...raw, extra: true }), /Snapshot/);
});
