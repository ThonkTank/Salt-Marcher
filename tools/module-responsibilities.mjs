// Owners of the extracted seams. These are code boundaries, not a test catalog.
export const responsibilities = {
  'workspace composition': {
    kind: 'presentation',
    files: [
      'src/app/workspace/renderer.ts',
      'src/app/workspace/workspace-editors.ts',
      'src/app/workspace/workspace-activation.ts',
      'src/app/workspace/workspace-opening.ts',
    ],
  },
  'preparation editor': { kind: 'presentation', files: ['src/app/campaign/preparation.ts'] },
  'live editor': {
    kind: 'presentation',
    files: [
      'src/app/runtime/live.ts',
      'src/app/runtime/live-recap-editor.ts',
      'src/app/runtime/live-moment-editor.ts',
      'src/app/runtime/live-knowledge-ui.ts',
      'src/app/runtime/live-session-close-ui.ts',
      'src/app/runtime/live-session-resume-ui.ts',
    ],
  },
  'combat editor': { kind: 'presentation', files: ['src/app/runtime/combat.ts'] },
  'world composition': {
    kind: 'presentation',
    files: ['src/app/runtime/world-ui.ts', 'src/app/runtime/world-editor-surface.ts'],
  },
  'world map and places': { kind: 'presentation', files: ['src/app/runtime/world-map-editor.ts'] },
  'world travel': { kind: 'presentation', files: ['src/app/runtime/world-travel-editor.ts'] },
  'world calendar and agenda': {
    kind: 'presentation',
    files: ['src/app/runtime/world-calendar-editor.ts', 'src/app/runtime/agenda-ui.ts'],
  },
  'world weather': { kind: 'presentation', files: ['src/app/runtime/world-weather-editor.ts'] },
  'world writes': { kind: 'presentation', files: ['src/app/runtime/world-write-coordinator.ts'] },
  'world owner contracts': {
    kind: 'domain',
    files: ['src/app/runtime/world-owner-ports.ts', 'src/app/runtime/world-editor-types.ts'],
  },
  'editor surface': {
    kind: 'presentation',
    files: ['src/app/shared/editor-surface.ts', 'src/app/shared/owned-event-target.ts'],
  },
  'editor lifecycle': {
    kind: 'domain',
    files: [
      'src/app/shared/editor-session.ts',
      'src/app/shared/editor-registry.ts',
      'src/app/shared/editor-transition.ts',
    ],
  },
  'basic contracts and text': {
    kind: 'domain',
    files: [
      'src/app/shared/contracts.ts',
      'src/app/shared/desk-reference.ts',
      'src/app/shared/raw-text-offset.ts',
      'src/app/shared/room-validation.ts',
    ],
  },
  'command receipts': { kind: 'domain', files: ['src/app/shared/commit-receipt.ts'] },
  'canonical storage': { kind: 'storage', prefixes: ['src/app/storage/'] },
  'native host': { kind: 'host', prefixes: ['desktop/'] },
};
export const rendererEntries = [
  'src/app/workspace/renderer.ts',
  'src/app/runtime/player-display.ts',
  'src/app/campaign/preset-settings-ui.ts',
  'src/app/atlas/atlas-deck-runtime.ts',
  'src/app/atlas/atlas-brush-worker.ts',
];
export function responsibility(file) {
  for (const [name, owner] of Object.entries(responsibilities))
    if (owner.files?.includes(file) || owner.prefixes?.some((prefix) => file.startsWith(prefix)))
      return { name, kind: owner.kind };
  return null;
}
