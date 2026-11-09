/** P0 uses the plan's caps; these are limits, never permission to discard edits. */
export const editorBudgets = Object.freeze({
  sourceBytes: 256 * 1024 * 1024,
  presentationBytes: 128 * 1024 * 1024,
  gpuBytes: 256 * 1024 * 1024,
  historyBytes: 128 * 1024 * 1024,
  historyActions: 100,
  pendingWriteBytes: 32 * 1024 * 1024,
  computeWorkers: 2,
  uploadBytesPerFrame: 4 * 1024 * 1024,
  retainedTiles: 96,
  observationEvents: 120_000,
});
