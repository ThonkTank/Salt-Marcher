import { describe, expect, it, vi } from "vitest";
import type {
  AtlasDesktop,
  CommitReceipt,
  CommitRequest,
  ProjectInfo,
  SaveResult,
} from "./bridge";
import { EditorDocument } from "./model";
import { ProjectSession } from "./ProjectSession";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function edit(document: EditorDocument, x = 100) {
  document.beginGesture({ level: 0, radius: 10, amount: 20 });
  document.applySegment([x, 100], [x, 100], 50);
  return document.finishGesture()!;
}

/** Real admitted coefficients, deliberately not materialized by the caller yet. */
function finishingEdit(document: EditorDocument) {
  document.beginPrepaidGesture(
    { level: 0, radius: 10, amount: 20 },
    {
      sessionId: document.sessionId,
      gestureId: 1,
      viewId: 1,
      preparationId: 1,
    },
  );
  document.admitBrushBatch({
    admissionId: 1,
    path: { from: [100, 100], points: [[160, 100]], end: true },
    time: [{ from: [100, 100], to: [160, 100], elapsedMs: 20 }],
    pointCount: 1,
  });
  document.sealBrushGesture();
  expect(document.finishing).toBe(true);
}

function finishAcceptedWork(document: EditorDocument) {
  // This uses the product materializer, independently of the save's promise.
  for (let step = 0; document.finishing && step < 1000; step++)
    document.advanceBrushGesture({ maxCells: 8, maxMs: 100 });
  expect(document.finishing).toBe(false);
}

function fixture() {
  const info: ProjectInfo = {
    sessionId: "session",
    projectId: "project",
    format: 24,
    title: "Testwelt",
    sequence: 0,
    savedSequence: 0,
    path: "/world.saltatlas",
    activeLevels: [],
    sourceTiles: 0,
  };
  let sequence = 0;
  const committed = new Map<string, CommitRequest>();
  const commit = vi.fn(async (request: CommitRequest) => {
    const old = committed.get(request.transactionId);
    if (old) {
      if (old.sequence !== request.sequence)
        throw new Error("conflicting replay");
    } else {
      if (request.sequence !== sequence + 1) throw new Error("out of order");
      committed.set(request.transactionId, request);
      sequence = request.sequence;
    }
    return {
      sessionId: info.sessionId,
      sequence: request.sequence,
      transactionId: request.transactionId,
    };
  });
  const bridge: AtlasDesktop = {
    diagnostics: false,
    onFileAction: () => () => {},
    status: vi.fn(async () => ({ ...info, sequence })),
    readRegion: vi.fn(),
    readPresentation: vi.fn(),
    commit,
    newProject: vi.fn(async () => null),
    openProject: vi.fn(async () => null),
    saveProject: vi.fn(async (request) => ({
      sessionId: request.sessionId,
      sequence,
      savedSequence: request.sequence,
      path: "/world.saltatlas",
    })),
    metrics: vi.fn(),
  };
  const observer = { changed: vi.fn(), persisted: vi.fn(), failed: vi.fn() };
  const document = new EditorDocument(info.sessionId, { empty: true });
  const session = new ProjectSession(bridge, observer);
  session.attach(document, info);
  return { info, document, session, bridge, observer, committed, commit };
}

describe("one document journal and ordered project session", () => {
  it("saves only the full accepted finishing action and restores its terminal endpoint", async () => {
    const { document, session, bridge, committed } = fixture();
    finishingEdit(document);
    expect(() => session.preparedDocument()).toThrow(/nicht abgeschlossen/);
    const saving = session.save();
    await Promise.resolve();
    expect(bridge.commit).not.toHaveBeenCalled();
    expect(bridge.saveProject).not.toHaveBeenCalled();
    document.advanceBrushGesture({ maxCells: 1, maxMs: 100 });
    await Promise.resolve();
    expect(document.finishing).toBe(true);
    expect(document.sequence).toBe(0);
    expect(bridge.commit).not.toHaveBeenCalled();
    finishAcceptedWork(document);
    await saving;
    expect(document.sequence).toBe(1);
    expect(document.metrics.historyActions).toBe(1);
    expect(bridge.commit).toHaveBeenCalledTimes(1);
    expect(bridge.saveProject).toHaveBeenCalledWith({
      sessionId: document.sessionId,
      sequence: 1,
      saveAs: false,
    });
    const saved = new EditorDocument("reopened", { empty: true, sequence: 1 });
    saved.acceptCoverage(
      [0, 0, 200, 200],
      [...committed.values()].flatMap((request) =>
        request.patches.flatMap((patch) => (patch.after ? [patch.after] : [])),
      ),
      1,
      saved.sessionId,
      0,
    );
    expect(saved.sampleHeight(160, 100)).toBe(document.sampleHeight(160, 100));
    expect(saved.sampleHeight(160, 100)).toBeGreaterThan(-100);
    document.undo();
    expect(document.sampleHeight(100, 100)).toBe(-100);
    expect(document.sampleHeight(160, 100)).toBe(-100);
  });

  it.each(["cancel", "failed-open"] as const)(
    "%s preserves the accepted tail and history through the file-action barrier",
    async (decision) => {
      const { document, session, bridge } = fixture();
      finishingEdit(document);
      if (decision === "failed-open")
        vi.mocked(bridge.openProject).mockRejectedValue(
          new Error("invalid file"),
        );
      session.beginFileAction("renderer");
      const changing = session.changeProject(false);
      await Promise.resolve();
      expect(bridge.openProject).not.toHaveBeenCalled();
      expect(document.finishing).toBe(true);
      finishAcceptedWork(document);
      if (decision === "failed-open")
        await expect(changing).rejects.toThrow("invalid file");
      else await expect(changing).resolves.toBeNull();
      session.endFileAction("renderer");
      expect(document.sequence).toBe(1);
      expect(document.metrics.historyActions).toBe(1);
      expect(document.sampleHeight(160, 100)).toBeGreaterThan(-100);
      expect(session.editable).toBe(true);
      expect(session.saved).toBe(false);
    },
  );

  it("rejects an abandoned finishing barrier before it can save the replacement session", async () => {
    const { document, session, bridge, info } = fixture();
    finishingEdit(document);
    const saving = session.save();
    const replacement = new EditorDocument("replacement", { empty: true });
    session.attach(replacement, { ...info, sessionId: replacement.sessionId });
    document.invalidateContinuation();
    await expect(saving).rejects.toThrow();
    expect(bridge.commit).not.toHaveBeenCalled();
    expect(bridge.saveProject).not.toHaveBeenCalled();
    expect(replacement.sampleHeight(160, 100)).toBe(-100);
    expect(session.error).toBeNull();
    expect(session.saved).toBe(true);
  });

  it.each(["save", "native-prepare"] as const)(
    "%s rejects a disposed action instead of taking an incomplete snapshot",
    async (operation) => {
      const { document, session, bridge } = fixture();
      finishingEdit(document);
      if (operation === "native-prepare") session.beginFileAction("native");
      const pending =
        operation === "save" ? session.save() : session.prepareFileAction();
      const rejected = expect(pending).rejects.toThrow();
      document.invalidateContinuation();
      await rejected;
      expect(bridge.commit).not.toHaveBeenCalled();
      expect(bridge.saveProject).not.toHaveBeenCalled();
      expect(document.sequence).toBe(0);
      expect(session.error).toBeNull();
      if (operation === "native-prepare") session.endFileAction("native");
    },
  );

  it("rejects disposal while a completed action waits for its writer receipt", async () => {
    const { document, session, bridge, observer } = fixture();
    const change = edit(document);
    const pendingReceipt = deferred<CommitReceipt>();
    vi.mocked(bridge.commit).mockReturnValueOnce(pendingReceipt.promise);
    const saving = session.save();
    const rejected = expect(saving).rejects.toThrow(/beendet/);
    await vi.waitFor(() => expect(bridge.commit).toHaveBeenCalledOnce());
    expect(session.writing).toBe(true);
    document.invalidateContinuation();
    pendingReceipt.resolve({
      sessionId: change.sessionId,
      sequence: change.sequence,
      transactionId: change.transactionId,
    });
    await rejected;
    expect(bridge.saveProject).not.toHaveBeenCalled();
    expect(observer.persisted).not.toHaveBeenCalled();
    expect(document.persistedSequence).toBe(0);
    expect(session.error).toBeNull();
  });

  it("rejects disposal during recovery status before replaying the abandoned journal", async () => {
    const { document, session, bridge, observer, info } = fixture();
    edit(document);
    const pendingStatus = deferred<ProjectInfo>();
    vi.mocked(bridge.status).mockReturnValueOnce(pendingStatus.promise);
    const recovering = session.recover();
    const rejected = expect(recovering).rejects.toThrow(/beendet/);
    await vi.waitFor(() => expect(bridge.status).toHaveBeenCalledOnce());
    document.invalidateContinuation();
    pendingStatus.resolve(info);
    await rejected;
    expect(bridge.commit).not.toHaveBeenCalled();
    expect(observer.failed).not.toHaveBeenCalled();
    expect(session.error).toBeNull();
  });

  it("never converts a failed action barrier into a prepared native snapshot", async () => {
    const { document, session, bridge } = fixture();
    vi.spyOn(document, "whenActionFinished").mockRejectedValue(
      new Error("action completion failed"),
    );
    session.beginFileAction("native");
    await expect(session.prepareFileAction()).rejects.toThrow(
      "action completion failed",
    );
    expect(bridge.commit).not.toHaveBeenCalled();
    expect(session.error).toBeNull();
    session.endFileAction("native");
  });

  it("recovery includes the accepted finishing tail after an earlier lost ACK", async () => {
    const { document, session, bridge, commit, committed } = fixture();
    const send = commit.getMockImplementation()!;
    bridge.commit = vi
      .fn()
      .mockImplementationOnce(async (request) => {
        await send(request);
        throw new Error("lost ACK");
      })
      .mockImplementation(send);
    edit(document);
    session.persist();
    await expect(session.flush()).rejects.toThrow("lost ACK");
    finishingEdit(document);
    const recovering = session.recover();
    await Promise.resolve();
    expect(bridge.status).not.toHaveBeenCalled();
    finishAcceptedWork(document);
    const endpoint = document.sampleHeight(160, 100);
    await recovering;
    expect(committed.size).toBe(2);
    expect(
      vi.mocked(bridge.commit).mock.calls.map(([request]) => request.sequence),
    ).toEqual([1, 1, 2]);
    expect(document.persistedSequence).toBe(2);
    expect(document.metrics.historyActions).toBe(2);
    expect(document.sampleHeight(160, 100)).toBe(endpoint);
    expect(session.error).toBeNull();
  });

  it("drains changes accepted during an ACK in order and releases their projection data", async () => {
    const { document, session, bridge, commit } = fixture();
    const firstAck = deferred<Awaited<ReturnType<AtlasDesktop["commit"]>>>();
    const send = commit.getMockImplementation()!;
    bridge.commit = vi.fn(async (request) => {
      const receipt = await send(request);
      if (request.sequence === 1) return firstAck.promise;
      return receipt;
    });
    const first = edit(document);
    session.persist();
    const second = edit(document, 120);
    session.persist();
    expect(bridge.commit).toHaveBeenCalledTimes(1);
    expect(document.pendingChanges().map((change) => change.sequence)).toEqual([
      1, 2,
    ]);
    expect(session.writing).toBe(true);
    firstAck.resolve({
      sessionId: document.sessionId,
      sequence: first.sequence,
      transactionId: first.transactionId,
    });
    await session.flush();
    expect(
      vi.mocked(bridge.commit).mock.calls.map(([request]) => request.sequence),
    ).toEqual([1, 2]);
    expect(document.persistedSequence).toBe(second.sequence);
    expect(document.pendingChanges()).toEqual([]);
    expect(document.metrics.pendingBytes).toBe(0);
    expect(document.canUndo).toBe(true);
    expect(session.writing).toBe(false);
    expect(session.saved).toBe(false);
  });

  it("replays the original accepted record after an ACK is lost without applying it twice", async () => {
    const { document, session, bridge, commit, committed } = fixture();
    const send = commit.getMockImplementation()!;
    let loseAck = true;
    bridge.commit = vi.fn(async (request) => {
      const receipt = await send(request);
      if (loseAck) {
        loseAck = false;
        throw new Error("lost ACK");
      }
      return receipt;
    });
    const first = edit(document);
    session.persist();
    await expect(session.flush()).rejects.toThrow("lost ACK");
    expect(session.editable).toBe(false);
    expect(document.persistedSequence).toBe(0);
    expect(document.pendingChanges()).toHaveLength(1);
    const height = document.sampleHeight(100, 100);
    await session.recover();
    expect(committed.size).toBe(1);
    expect(
      vi
        .mocked(bridge.commit)
        .mock.calls.map(([request]) => request.transactionId),
    ).toEqual([first.transactionId, first.transactionId]);
    expect(document.sampleHeight(100, 100)).toBe(height);
    expect(document.pendingChanges()).toEqual([]);
    expect(document.persistedSequence).toBe(1);
    expect(session.error).toBeNull();
    expect(session.editable).toBe(true);
  });

  it("a failed write retains every later accepted change for one ordered recovery", async () => {
    const { document, session, bridge, commit } = fixture();
    const failure = deferred<never>();
    const send = commit.getMockImplementation()!;
    bridge.commit = vi
      .fn()
      .mockImplementationOnce(() => failure.promise)
      .mockImplementation(send);
    edit(document);
    session.persist();
    edit(document, 120);
    session.persist();
    failure.reject(new Error("disk failed"));
    await expect(session.flush()).rejects.toThrow("disk failed");
    expect(bridge.commit).toHaveBeenCalledTimes(1);
    expect(document.pendingChanges()).toHaveLength(2);
    session.beginFileAction("native");
    const prepared = await session.prepareFileAction();
    expect(prepared).toMatchObject({
      sequence: 2,
      persistenceError: "disk failed",
    });
    await session.recover();
    expect(
      vi.mocked(bridge.commit).mock.calls.map(([request]) => request.sequence),
    ).toEqual([1, 1, 2]);
    expect(document.persistedSequence).toBe(2);
    expect(document.pendingChanges()).toEqual([]);
    expect(session.changingProject).toBe(true);
    session.endFileAction("native");
    expect(session.editable).toBe(true);
  });

  it("rejects a mismatched receipt without releasing history or retry data", async () => {
    const { document, session, bridge } = fixture();
    bridge.commit = vi.fn(async (request) => ({
      sessionId: "wrong-session",
      sequence: request.sequence,
      transactionId: request.transactionId,
    }));
    edit(document);
    await expect(session.flush()).rejects.toThrow(/Speicherbestätigung/);
    expect(document.persistedSequence).toBe(0);
    expect(document.pendingChanges()).toHaveLength(1);
    expect(document.canUndo).toBe(true);
  });

  it("cannot acknowledge a later queued change in response to the first write", async () => {
    const { document, session, bridge } = fixture();
    edit(document);
    const second = edit(document, 120);
    bridge.commit = vi.fn(async () => ({
      sessionId: document.sessionId,
      sequence: second.sequence,
      transactionId: second.transactionId,
    }));
    await expect(session.flush()).rejects.toThrow(/Speicherbestätigung/);
    expect(bridge.commit).toHaveBeenCalledTimes(1);
    expect(document.persistedSequence).toBe(0);
    expect(document.pendingChanges()).toHaveLength(2);
  });

  it("does not mark edits accepted after a reserved save as saved", async () => {
    const { document, session, bridge } = fixture();
    const saved = deferred<SaveResult>();
    bridge.saveProject = vi.fn(() => saved.promise);
    edit(document);
    const saving = session.save();
    await vi.waitFor(() => expect(bridge.saveProject).toHaveBeenCalledTimes(1));
    expect(vi.mocked(bridge.saveProject).mock.calls[0][0].sequence).toBe(1);
    edit(document, 120);
    session.persist();
    await session.flush();
    saved.resolve({
      sessionId: document.sessionId,
      sequence: 2,
      savedSequence: 1,
      path: "/world.saltatlas",
    });
    await saving;
    expect(document.sequence).toBe(2);
    expect(session.saved).toBe(false);
    expect(document.canUndo).toBe(true);
  });

  it("only the file action's owner can release its lock, including a rejected close", async () => {
    const { session } = fixture();
    session.beginFileAction("renderer");
    expect(() => session.beginFileAction("native")).toThrow(/Datei-/);
    session.endFileAction("native");
    expect(session.changingProject).toBe(true);
    expect(session.editable).toBe(false);
    session.endFileAction("renderer");
    expect(session.changingProject).toBe(false);
    expect(session.editable).toBe(true);
  });

  it("rejects a save receipt for another snapshot without marking local changes saved", async () => {
    const { document, session, bridge } = fixture();
    edit(document);
    bridge.saveProject = vi.fn(async (request) => ({
      sessionId: request.sessionId,
      sequence: request.sequence,
      savedSequence: request.sequence - 1,
      path: "/wrong.saltatlas",
    }));
    await expect(session.save()).rejects.toThrow(/reservierten Dokumentstand/);
    expect(session.saved).toBe(false);
    expect(document.sequence).toBe(1);
    expect(document.persistedSequence).toBe(1);
  });

  it("recovery from a different store session leaves all local edits intact", async () => {
    const { document, session, bridge } = fixture();
    bridge.commit = vi.fn(async () => {
      throw new Error("store unavailable");
    });
    edit(document);
    await expect(session.flush()).rejects.toThrow("store unavailable");
    vi.mocked(bridge.status).mockResolvedValue({
      ...(await bridge.status()),
      sessionId: "other",
    });
    await expect(session.recover()).rejects.toThrow(/Arbeitskopie passt nicht/);
    expect(document.pendingChanges()).toHaveLength(1);
    expect(document.persistedSequence).toBe(0);
    expect(session.editable).toBe(false);
  });
});
