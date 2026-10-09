(async () => {
  const boundary = {
    requireType: typeof globalThis.require,
    processType: typeof globalThis.process,
    ipcRendererType: typeof globalThis.ipcRenderer,
    rawSendType: typeof globalThis.p01?.send,
    apiFrozen: Object.isFrozen(globalThis.p01),
    directFileDenied: false,
  };
  try { await fetch("file:///etc/hosts"); } catch { boundary.directFileDenied = true; }
  const opened = await globalThis.p01.invoke("openMap", { mapId: "fixture", expectedRevision: 0 });
  let invalidation;
  let resolveInvalidation;
  const invalidationPromise = new Promise((resolve) => { resolveInvalidation = resolve; });
  let subscriptionId;
  const unsubscribe = globalThis.p01.subscribe((value) => {
    if (value.subscriptionId !== subscriptionId) return;
    invalidation = value;
    resolveInvalidation(value);
  });
  ({ subscriptionId } = await globalThis.p01.invoke("subscribeMapInvalidation", {
    mapHandle: opened.handle,
    revision: 0,
  }));
  let finalDigest = opened.snapshot.digest;
  let movedEntityId;
  let undoDigest;
  let redoDigest;
  const assetData = "H02 bounded asset";
  const assetHash = "c348c197874a7f4a863b9e575a5e19de12a7a2a76cc12649e4ea1eb7116f71e1";
  const asset = await globalThis.p01.invoke("readAsset", {
    mapHandle: opened.handle,
    assetId: "h02-manifest",
    expectedHash: assetHash,
  });
  if (P01_CONFIG.mode === "edit") {
    const movable = opened.snapshot.document.entities.find((entity) =>
      typeof entity.x === "number" && typeof entity.y === "number");
    if (!movable) throw new Error("fixture has no movable entity");
    movedEntityId = movable.id;
    const changed = await globalThis.p01.invoke("executeMapCommand", {
      mapHandle: opened.handle,
      expectedRevision: 0,
      command: { kind: "moveEntity", entityId: movable.id, dx: 1.25, dy: -0.75 },
    });
    await Promise.race([invalidationPromise, new Promise((_, reject) =>
      setTimeout(() => reject(new Error("invalidation timeout")), 5000))]);
    const undone = await globalThis.p01.invoke("executeMapCommand", {
      mapHandle: opened.handle,
      expectedRevision: changed.revision,
      command: { kind: "undo" },
    });
    undoDigest = undone.digest;
    const redone = await globalThis.p01.invoke("executeMapCommand", {
      mapHandle: opened.handle,
      expectedRevision: undone.revision,
      command: { kind: "redo" },
    });
    redoDigest = redone.digest;
    if (undoDigest !== opened.snapshot.digest || redoDigest !== changed.digest)
      throw new Error("undo/redo digest mismatch");
    const saved = await globalThis.p01.invoke("saveMap", {
      mapHandle: opened.handle,
      expectedRevision: redone.revision,
    });
    finalDigest = saved.digest;
  }
  unsubscribe();
  if (P01_CONFIG.expectedDigest && P01_CONFIG.expectedDigest !== finalDigest)
    throw new Error("fresh reopen digest mismatch");
  console.log("P01_RESULT " + JSON.stringify({ boundary, initialDigest: opened.snapshot.digest,
    finalDigest, movedEntityId, undoDigest, redoDigest, invalidation,
    asset: { id: asset.assetId, hash: asset.hash, dataMatches: asset.data === assetData },
    rendererToken: P01_CONFIG.rendererToken, completedAt: new Date().toISOString() }));
})().catch((error) => console.error("P01_ERROR " + String(error?.stack ?? error)));
