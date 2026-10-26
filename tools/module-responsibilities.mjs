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
  'live editor': { kind: 'presentation', files: ['src/app/runtime/live.ts'] },
  'combat editor': { kind: 'presentation', files: ['src/app/runtime/combat.ts'] },
  'editor surface': { kind: 'presentation', files: ['src/app/shared/editor-surface.ts'] },
  'editor lifecycle': {
    kind: 'domain',
    files: [
      'src/app/shared/editor-session.ts',
      'src/app/shared/editor-registry.ts',
      'src/app/shared/editor-transition.ts',
    ],
  },
  'command receipts': { kind: 'domain', files: ['src/app/shared/commit-receipt.ts'] },
  'canonical storage': { kind: 'storage', prefixes: ['src/app/storage/'] },
  'native host': { kind: 'host', prefixes: ['desktop/'] },
};
export const rendererEntries = [
  'src/app/workspace/renderer.ts',
  'src/app/runtime/player-display.ts',
];
export function responsibility(file) {
  for (const [name, owner] of Object.entries(responsibilities))
    if (owner.files?.includes(file) || owner.prefixes?.some((prefix) => file.startsWith(prefix)))
      return { name, kind: owner.kind };
  return null;
}
