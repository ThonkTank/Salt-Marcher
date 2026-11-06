import { deferred } from "../../tests/support/deferred";
import { describe, expect, it, vi } from "vitest";
import { AtlasClient, type Commands } from "./client";
import {
  DocumentQueue,
  documentQueueFor,
  type SessionUI,
} from "./documentQueue";
import type { Intent, Status, ValidPreview, Version } from "./model";
import { WireError } from "../wireError";

const status = (revision = 0, sessionId = "one"): Status => ({
  sessionId,
  revision,
  path: null,
  dirty: revision > 0,
  canUndo: revision > 0,
  canRedo: false,
  changes: null,
});
const intent = (name = "first"): Intent => ({
  type: "rename",
  id: "house",
  name,
});
const action = (operationId = 1) => ({
  operationId,
  intent: intent(String(operationId)),
});
function preview(s: Status): ValidPreview {
  return {
    valid: true,
    version: s,
    status: s,
    objects: [],
    removed: [],
    changed: true,
    deletedIds: [],
    removedConnections: [],
    cascadeCounts: {
      roads: 0,
      parcels: 0,
      houses: 0,
      rooms: 0,
      connections: 0,
    },
    generationSummary: {
      createdParcels: 0,
      createdHouses: 0,
      emptyParcels: 0,
      skippedParcels: 0,
      unplacedHouses: 0,
      limited: false,
    },
    generationDiagnostics: [],
    generationLimit: null,
  };
}
type Call = { cmd: keyof Commands; args: Record<string, unknown> };
function fake() {
  let current = status();
  const calls: Call[] = [];
  let intercept: ((call: Call) => Promise<unknown> | undefined) | undefined;
  const transport = async (cmd: string, args: Record<string, unknown>) => {
    const call = { cmd: cmd as keyof Commands, args };
    calls.push(call);
    const held = intercept?.(call);
    if (held) return held;
    if (cmd === "status") return structuredClone(current);
    if (cmd === "preview") return preview(current);
    if (cmd === "new") {
      current = status(0, "replacement");
      return current;
    }
    current = { ...current, revision: current.revision + 1, dirty: true };
    return cmd === "commit" ? preview(current) : current;
  };
  const client = new AtlasClient(transport);
  const save = vi.spyOn(client, "save").mockImplementation(async () => {
    current = { ...current, dirty: false, path: "saved.saltatlas" };
    return current;
  });
  const open = vi.spyOn(client, "open").mockImplementation(async () => {
    current = status(0, "opened");
    return current;
  });
  const close = vi.spyOn(client, "close").mockResolvedValue();
  const queue = documentQueueFor(client);
  return {
    client,
    queue,
    calls,
    save,
    open,
    close,
    intercept: (fn: typeof intercept) => {
      intercept = fn;
    },
    setStatus: (value: Status) => {
      current = value;
    },
  };
}
async function mount(
  queue: DocumentQueue,
  ui: SessionUI = { confirm: async () => "discard" },
) {
  const lease = queue.attach(ui);
  await queue.ready(lease);
  return lease;
}
const sent = (f: ReturnType<typeof fake>, cmd: keyof Commands) =>
  f.calls.filter((c) => c.cmd === cmd);

describe("document queue protocol", () => {
  it("returns a direct edit's domain issue without poisoning the next write", async () => {
    const f = fake(),
      lease = await mount(f.queue);
    const issue = {
      code: "collision" as const,
      objectIds: [],
      message: "Kollision",
    };
    f.intercept((call) =>
      call.cmd === "commit"
        ? Promise.reject(new WireError("invalidInput", issue.message, issue))
        : undefined,
    );
    await expect(
      f.queue.commitExact(lease, action(), status(), () => true),
    ).rejects.toMatchObject({ category: "invalidInput", issue });
    expect(f.queue.getSnapshot()).toMatchObject({
      pending: 0,
      uncertain: false,
      status: { revision: 0 },
    });
    f.intercept(undefined);
    expect(
      (await f.queue.commitExact(lease, action(), status(), () => true))?.status
        .revision,
    ).toBe(1);
    expect(sent(f, "commit")).toHaveLength(2);
  });
  it("recovery while draining abandons a reserved but undispatched document action", async () => {
    const f = fake(),
      lease = await mount(f.queue),
      held = deferred<ValidPreview>();
    f.intercept((call) => (call.cmd === "commit" ? held.promise : undefined));
    const write = f.queue.commit(lease, intent()),
      doc = f.queue.document(lease, "new");
    held.reject(Error("unknown commit"));
    await write;
    await doc;
    expect(f.queue.getSnapshot()).toMatchObject({
      uncertain: false,
      exclusive: false,
      recoveryEpoch: 1,
    });
    expect(sent(f, "new")).toHaveLength(0);
    expect(await f.queue.document(lease, "new")).toBe("finished");
    expect(sent(f, "new")).toHaveLength(1);
  });
  it("a rejected exact preview request still revokes that lease's older response", async () => {
    const f = fake(),
      lease = await mount(f.queue),
      held = deferred<ValidPreview>();
    f.intercept((call) => (call.cmd === "preview" ? held.promise : undefined));
    const old = f.queue.inspect(lease, action());
    expect(await f.queue.inspect(lease, action(2), status(99))).toBeNull();
    held.resolve(preview(status()));
    expect(await old).toBeNull();
    expect(sent(f, "preview")).toHaveLength(1);
  });
  it("links admission before notifying a subscriber that immediately enqueues", async () => {
    const f = fake(),
      lease = await mount(f.queue);
    let second: Promise<ValidPreview | null> | undefined;
    const dispose = f.queue.subscribe(() => {
      dispose();
      second = f.queue.commit(lease, intent("second"));
    });
    const first = f.queue.commit(lease, intent("first"));
    await first;
    await second;
    expect(
      sent(f, "commit").map((call) => [
        (call.args.intent as { name: string }).name,
        (call.args.version as Version).revision,
      ]),
    ).toEqual([
      ["first", 0],
      ["second", 1],
    ]);
  });
  it("a failed remount observation never exposes cached status and successful retry grants readiness", async () => {
    const f = fake(),
      oldLease = await mount(f.queue);
    await f.queue.commit(oldLease, intent());
    f.queue.detach(oldLease);
    f.intercept((call) =>
      call.cmd === "status" ? Promise.reject(Error("offline")) : undefined,
    );
    const lease = f.queue.attach({ confirm: async () => "cancel" });
    await f.queue.ready(lease);
    expect(f.queue.getSnapshot().status?.revision).toBe(1);
    expect(f.queue.isReady(lease)).toBe(false);
    expect(f.queue.getGate(lease).version).toBeNull();
    expect(await f.queue.commit(lease, intent())).toBeNull();
    expect(await f.queue.document(lease, "close")).toBe("finished");
    expect(f.close).not.toHaveBeenCalled();
    f.intercept(undefined);
    await f.queue.reconcile(lease);
    expect(f.queue.isReady(lease)).toBe(true);
    expect(f.queue.getGate(lease).version?.revision).toBe(1);
  });
  it("makes simultaneous mounts ready without competing status retries", async () => {
    const f = fake(),
      one = f.queue.attach({ confirm: async () => "discard" }),
      two = f.queue.attach({ confirm: async () => "discard" });
    await Promise.all([f.queue.ready(one), f.queue.ready(two)]);
    expect(f.queue.isReady(one)).toBe(true);
    expect(f.queue.isReady(two)).toBe(true);
    expect(sent(f, "status").length).toBeLessThanOrEqual(3);
  });
  it("rechecks the stable tail when a publication queues a write before ready resumes", async () => {
    const f = fake(),
      owner = await mount(f.queue),
      next = f.queue.attach({ confirm: async () => "discard" }),
      held = deferred<ValidPreview>();
    f.intercept((call) => (call.cmd === "commit" ? held.promise : undefined));
    let write: Promise<ValidPreview | null> | undefined;
    const dispose = f.queue.subscribe(() => {
      dispose();
      queueMicrotask(() => {
        write = f.queue.commit(owner, intent());
      });
    });
    const ready = f.queue.ready(next);
    await vi.waitFor(() => expect(sent(f, "commit")).toHaveLength(1));
    expect(f.queue.isReady(next)).toBe(false);
    f.setStatus(status(1));
    held.resolve(preview(status(1)));
    await write;
    await ready;
    expect(f.queue.getGate(next).version?.revision).toBe(1);
  });
  it("keeps immutable accepted FIFO work through detach and rebases on confirmed revisions", async () => {
    const f = fake(),
      first = await mount(f.queue),
      held = deferred<ValidPreview>();
    f.intercept((call) =>
      call.cmd === "commit" && sent(f, "commit").length === 1
        ? held.promise
        : undefined,
    );
    const input = intent(),
      one = f.queue.commit(first, input),
      two = f.queue.commit(first, intent("second"));
    if (input.type === "rename") input.name = "mutated";
    expect(f.queue.getSnapshot().pending).toBe(2);
    f.queue.detach(first);
    f.queue.detach(first);
    const next = f.queue.attach({ confirm: async () => "discard" });
    const ready = f.queue.ready(next);
    expect(f.queue.getGate(next).version).toBeNull();
    await vi.waitFor(() => expect(sent(f, "commit")).toHaveLength(1));
    f.setStatus(status(1));
    held.resolve(preview(status(1)));
    expect((await one)?.status.revision).toBe(1);
    expect((await two)?.status.revision).toBe(2);
    await ready;
    expect(f.queue.isReady(next)).toBe(true);
    expect(
      sent(f, "commit").map((c) => [
        (c.args.intent as { name: string }).name,
        (c.args.version as Version).revision,
      ]),
    ).toEqual([
      ["first", 0],
      ["second", 1],
    ]);
    expect(f.queue.getSnapshot().pending).toBe(0);
  });
  it("leaves following writes valid after invalidInput", async () => {
    const f = fake(),
      lease = await mount(f.queue);
    f.intercept((call) =>
      call.cmd === "commit" && sent(f, "commit").length === 1
        ? Promise.reject(new WireError("invalidInput", "bad"))
        : undefined,
    );
    const one = f.queue.commit(lease, intent()),
      two = f.queue.commit(lease, intent("valid"));
    expect(await one).toBeNull();
    expect((await two)?.status.revision).toBe(1);
    expect(f.queue.getSnapshot()).toMatchObject({
      uncertain: false,
      recoveryEpoch: 0,
      error: "",
    });
  });
  for (const applied of [false, true])
    it(`never resends an unknown commit (applied=${applied}) and cancels unsent jobs`, async () => {
      const f = fake(),
        lease = await mount(f.queue),
        held = deferred<ValidPreview>();
      f.intercept((call) => (call.cmd === "commit" ? held.promise : undefined));
      const one = f.queue.commit(lease, intent()),
        two = f.queue.commit(lease, intent("unsent"));
      if (applied) f.setStatus(status(1));
      held.reject(Error("lost"));
      expect(await one).toBeNull();
      expect(await two).toBeNull();
      expect(sent(f, "commit")).toHaveLength(1);
      expect(f.queue.getSnapshot()).toMatchObject({
        status: status(applied ? 1 : 0),
        uncertain: false,
        recoveryEpoch: 1,
        pending: 0,
      });
      expect(sent(f, "status")).toHaveLength(2);
    });
  it("keeps failed recovery uncertain until explicit successful reconcile", async () => {
    const f = fake(),
      lease = await mount(f.queue);
    f.intercept((call) =>
      call.cmd === "commit" || call.cmd === "status"
        ? Promise.reject(Error("offline"))
        : undefined,
    );
    expect(await f.queue.commit(lease, intent())).toBeNull();
    expect(f.queue.getSnapshot().uncertain).toBe(true);
    expect(await f.queue.commit(lease, intent())).toBeNull();
    expect(sent(f, "commit")).toHaveLength(1);
    f.intercept(undefined);
    await f.queue.reconcile(lease);
    expect(f.queue.getSnapshot().uncertain).toBe(false);
    expect(await f.queue.commit(lease, intent())).not.toBeNull();
  });
  it("recovers unknown history once and invalidates subsequent unsent work", async () => {
    const f = fake(),
      lease = await mount(f.queue);
    f.intercept((call) =>
      call.cmd === "history" ? Promise.reject(Error("lost")) : undefined,
    );
    const history = f.queue.history(lease, true),
      write = f.queue.commit(lease, intent());
    expect(await history).toBeNull();
    expect(await write).toBeNull();
    expect(sent(f, "history")).toHaveLength(1);
    expect(sent(f, "commit")).toHaveLength(0);
  });
  it("ignores an older status answer after a newer write publication", async () => {
    const f = fake(),
      lease = await mount(f.queue),
      old = deferred<Status>();
    f.intercept((call) =>
      call.cmd === "status" && sent(f, "status").length === 2
        ? old.promise
        : undefined,
    );
    const reconcile = f.queue.reconcile(lease);
    await vi.waitFor(() => expect(sent(f, "status")).toHaveLength(2));
    await f.queue.commit(lease, intent());
    old.resolve(status());
    await reconcile;
    expect(f.queue.getSnapshot().status?.revision).toBe(1);
  });
  it("a newer status request wins even when an older request fails later", async () => {
    const f = fake(),
      lease = await mount(f.queue),
      old = deferred<Status>();
    f.intercept((call) =>
      call.cmd === "status" && sent(f, "status").length === 2
        ? old.promise
        : undefined,
    );
    const one = f.queue.reconcile(lease);
    await vi.waitFor(() => expect(sent(f, "status")).toHaveLength(2));
    f.setStatus(status(2));
    await f.queue.reconcile(lease);
    old.reject(Error("old failure"));
    await one;
    expect(f.queue.getSnapshot()).toMatchObject({
      status: status(2),
      uncertain: false,
      error: "",
    });
  });
  it("checks ownership at admission, then owns the immutable write through detach", async () => {
    const f = fake(),
      lease = await mount(f.queue),
      exact = status();
    let owned = false;
    const cancelled = f.queue.commitExact(lease, action(), exact, () => owned);
    owned = false;
    expect(await cancelled).toBeNull();
    expect(sent(f, "commit")).toHaveLength(0);
    owned = true;
    const held = deferred<ValidPreview>();
    f.intercept((call) => (call.cmd === "commit" ? held.promise : undefined));
    const input = action(),
      version = { ...exact },
      running = f.queue.commitExact(lease, input, version, () => owned);
    version.revision = 999;
    if (input.intent.type === "rename") input.intent.name = "mutated";
    owned = false;
    f.queue.detach(lease);
    await vi.waitFor(() => expect(sent(f, "commit")).toHaveLength(1));
    held.resolve(preview(status(1)));
    expect((await running)?.status.revision).toBe(1);
    expect(sent(f, "commit")[0].args).toMatchObject({
      version: { revision: 0 },
      intent: { name: "1" },
    });
    expect(f.queue.getSnapshot().status?.revision).toBe(1);
  });
  it("rejects exact work with pending writes, reservation, stale version or unready lease", async () => {
    const f = fake(),
      lease = await mount(f.queue),
      held = deferred<ValidPreview>();
    const unready = f.queue.attach({ confirm: async () => "discard" });
    expect(await f.queue.commit(unready, intent())).toBeNull();
    expect(
      await f.queue.commitExact(lease, action(), status(1), () => true),
    ).toBeNull();
    f.intercept((call) => (call.cmd === "commit" ? held.promise : undefined));
    const write = f.queue.commit(lease, intent());
    expect(
      await f.queue.commitExact(lease, action(), status(), () => true),
    ).toBeNull();
    const doc = f.queue.document(lease, "save");
    expect(
      await f.queue.commitExact(lease, action(), status(), () => true),
    ).toBeNull();
    held.resolve(preview(status(1)));
    await write;
    await doc;
  });
  it("old lease clear/detach preserves the new lease's waiting preview and physical slot", async () => {
    const f = fake(),
      oldLease = await mount(f.queue),
      newLease = await mount(f.queue),
      held = deferred<ValidPreview>();
    f.intercept((call) =>
      call.cmd === "preview" && sent(f, "preview").length === 1
        ? held.promise
        : undefined,
    );
    const first = f.queue.inspect(oldLease, action(1)),
      latestAction = action(2),
      latest = f.queue.inspect(newLease, latestAction);
    if (latestAction.intent.type === "rename")
      latestAction.intent.name = "mutated";
    f.queue.clearPreview(oldLease);
    f.queue.detach(oldLease);
    expect(sent(f, "preview")).toHaveLength(1);
    held.reject(Error("stale error"));
    expect(await first).toBeNull();
    expect((await latest)?.actionId).toBe(2);
    expect(
      sent(f, "preview").map((c) => (c.args.intent as { name: string }).name),
    ).toEqual(["1", "2"]);
    expect(f.queue.getSnapshot().error).toBe("");
  });
  it("coalesces waiting previews and invalidates all preview work on write admission", async () => {
    const f = fake(),
      lease = await mount(f.queue),
      held = deferred<ValidPreview>();
    f.intercept((call) =>
      call.cmd === "preview" && sent(f, "preview").length === 1
        ? held.promise
        : undefined,
    );
    const first = f.queue.inspect(lease, action(1)),
      middle = f.queue.inspect(lease, action(2)),
      last = f.queue.inspect(lease, action(3));
    expect(await middle).toBeNull();
    await f.queue.commit(lease, intent());
    expect(await last).toBeNull();
    const fresh = f.queue.inspect(lease, action(4), status(1));
    held.resolve(preview(status()));
    expect(await first).toBeNull();
    expect((await fresh)?.actionId).toBe(4);
    expect(sent(f, "preview")).toHaveLength(2);
    expect(await f.queue.inspect(lease, action(5), status())).toBeNull();
  });
  it("reserves before draining and abandons New on detach without dropping writes", async () => {
    const f = fake(),
      lease = await mount(f.queue),
      held = deferred<ValidPreview>();
    f.intercept((call) => (call.cmd === "commit" ? held.promise : undefined));
    const write = f.queue.commit(lease, intent()),
      doc = f.queue.document(lease, "new");
    expect(f.queue.getSnapshot().exclusive).toBe(true);
    expect(await f.queue.document(lease, "save")).toBe("ignored");
    expect(await f.queue.commit(lease, intent())).toBeNull();
    f.queue.detach(lease);
    const next = f.queue.attach({ confirm: async () => "discard" }),
      ready = f.queue.ready(next);
    expect(f.queue.getGate(next).version).toBeNull();
    f.setStatus(status(1));
    held.resolve(preview(status(1)));
    await write;
    expect(await doc).toBe("finished");
    await ready;
    expect(sent(f, "new")).toHaveLength(0);
    expect(f.queue.getSnapshot().status?.revision).toBe(1);
  });
  for (const kind of ["save", "open"] as const)
    for (const lost of [false, true])
      it(`holds ${kind} reservation through detach and response (lost=${lost})`, async () => {
        const f = fake(),
          lease = await mount(f.queue),
          held = deferred<Status | null>();
        f[kind].mockReturnValue(held.promise);
        const doc = f.queue.document(lease, kind);
        await vi.waitFor(() => expect(f[kind]).toHaveBeenCalledOnce());
        f.queue.detach(lease);
        const next = f.queue.attach({ confirm: async () => "discard" }),
          ready = f.queue.ready(next);
        expect(f.queue.getSnapshot().exclusive).toBe(true);
        expect(f.queue.getGate(next).version).toBeNull();
        const result = {
          ...status(0, kind === "open" ? "opened" : "one"),
          path: "saved.saltatlas",
        };
        f.setStatus(result);
        if (lost) held.reject(Error("lost"));
        else held.resolve(result);
        expect(await doc).toBe("finished");
        await ready;
        expect(f.queue.getSnapshot()).toMatchObject({
          status: result,
          exclusive: false,
          uncertain: false,
        });
        expect(f[kind]).toHaveBeenCalledOnce();
      });
  it("publishes Save after detach but does not start the following Open", async () => {
    const f = fake();
    f.setStatus(status(1));
    const lease = await mount(f.queue, { confirm: async () => "save" }),
      held = deferred<Status | null>();
    f.save.mockReturnValue(held.promise);
    const doc = f.queue.document(lease, "open");
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledOnce());
    f.queue.detach(lease);
    const saved = { ...status(1), dirty: false, path: "saved.saltatlas" };
    held.resolve(saved);
    await doc;
    expect(f.open).not.toHaveBeenCalled();
    expect(f.queue.getSnapshot().status).toEqual(saved);
  });
  it("checks lease and document ownership after confirmation resolves", async () => {
    const f = fake();
    f.setStatus(status(1));
    const choice = deferred<"discard">();
    const confirm = vi.fn(() => choice.promise),
      lease = await mount(f.queue, { confirm });
    const doc = f.queue.document(lease, "new");
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    choice.resolve("discard");
    f.queue.detach(lease);
    await doc;
    expect(sent(f, "new")).toHaveLength(0);
  });
  it("cancelled picker releases reservation and uncertain Close can explicitly discard", async () => {
    const f = fake(),
      confirm = vi.fn(async () => "discard" as const),
      lease = await mount(f.queue, { confirm });
    f.save.mockResolvedValue(null);
    expect(await f.queue.document(lease, "save")).toBe("finished");
    f.intercept((call) =>
      call.cmd === "status" ? Promise.reject(Error("offline")) : undefined,
    );
    await f.queue.reconcile(lease);
    expect(await f.queue.document(lease, "new")).toBe("ignored");
    expect(await f.queue.document(lease, "close")).toBe("finished");
    expect(confirm).toHaveBeenCalledWith(true);
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.queue.getSnapshot().exclusive).toBe(false);
  });
  it("keeps snapshots stable until publication and acknowledges only matching session/revision", async () => {
    const f = fake(),
      lease = await mount(f.queue),
      before = f.queue.getSnapshot(),
      listener = vi.fn(),
      dispose = f.queue.subscribe(listener);
    expect(f.queue.getSnapshot()).toBe(before);
    expect(Object.isFrozen(before)).toBe(true);
    await f.queue.commit(lease, intent());
    expect(before.pending).toBe(0);
    expect(listener).toHaveBeenCalled();
    f.queue.acknowledge(status(2, "foreign"));
    expect(f.queue.getSnapshot().committed).not.toBeNull();
    f.queue.acknowledge(status());
    expect(f.queue.getSnapshot().committed).not.toBeNull();
    f.queue.acknowledge(status(1));
    expect(f.queue.getSnapshot().committed).toBeNull();
    await f.queue.commit(lease, intent());
    await f.queue.document(lease, "new");
    expect(f.queue.getSnapshot().committed).toBeNull();
    dispose();
  });
  it("has exactly one owner per client and isolates two clients", async () => {
    const a = fake(),
      b = fake();
    expect(documentQueueFor(a.client)).toBe(a.queue);
    expect(a.queue).not.toBe(b.queue);
    const one = await mount(a.queue),
      two = await mount(b.queue);
    await a.queue.commit(one, intent());
    expect(b.queue.getSnapshot().status?.revision).toBe(0);
    expect(sent(b, "commit")).toHaveLength(0);
    const held = deferred<ValidPreview>();
    a.intercept((call) => (call.cmd === "preview" ? held.promise : undefined));
    const previewA = a.queue.inspect(one, action());
    expect((await b.queue.inspect(two, action(2)))?.actionId).toBe(2);
    a.queue.detach(one);
    held.resolve(preview(status(1)));
    expect(await previewA).toBeNull();
    expect(await b.queue.commit(two, intent())).not.toBeNull();
  });
});
