// Build and check use the same entry inventory. Every entry has an execution environment.
export const desktopEntryEnvironments = {
  'desktop/main.ts': 'host',
  'desktop/preload.ts': 'host',
  'desktop/player-preload.ts': 'host',
  'desktop/update-helper.ts': 'host',
  'desktop/update-probe.ts': 'host',
  'desktop/terrain-route-worker.ts': 'worker',
  'desktop/atlas-region-worker.ts': 'worker',
  'desktop/room-directory-worker.ts': 'worker',
  'desktop/store-worker.ts': 'worker',
  'desktop/backup-validation-worker.ts': 'worker',
  'src/app/workspace/renderer.ts': 'renderer',
  'src/app/runtime/player-display.ts': 'renderer',
  'src/app/campaign/preset-settings-ui.ts': 'renderer',
  'src/app/atlas/atlas-deck-runtime.ts': 'renderer',
  'src/app/atlas/atlas-brush-worker.ts': 'browser-worker',
};
