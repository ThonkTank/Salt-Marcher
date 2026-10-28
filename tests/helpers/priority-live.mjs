import { combatInstance } from './priority-combat.mjs';
export function liveInstance(module, document, window) {
  return {
    ...module,
    ...module.createLive({
      // This fixture owns Live; tool navigation/output is qualified by its editor tests.
      world: { renderLiveWorld: async () => {} },
      items: { renderSceneShops: async () => {} },
      music: { refreshMusic: async () => {} },
      combat: combatInstance(module, document, window),
      roots: [
        'live',
        'character-dialog',
        'adoption-dialog',
        'move-dialog',
        'live-health-dialog',
        'archive-dialog',
        'live-session-resume-dialog',
      ]
        .map((id) => document.getElementById(id))
        .filter(Boolean),
      dialogHost: document.getElementById('live'),
      api: window.campaign,
      confirm: (message) => window.confirm(message),
      height: () => window.innerHeight,
      navigation: {
        partyAward: () => {
          document.getElementById('party-award-open')?.click();
        },
      },
    }),
  };
}
