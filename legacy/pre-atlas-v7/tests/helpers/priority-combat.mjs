export function combatInstance(module, document, window, navigation = {}) {
  const instance = {
    ...module,
    ...module.createCombat({
      roots: ['combat-panel', 'combat-finish-dialog', 'combat-initiative-dialog'].map((id) =>
        document.getElementById(id),
      ),
      api: window.campaign,
      matchMedia: (query) => window.matchMedia?.(query) ?? { matches: false },
      requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
      navigation: {
        scene: () => document.getElementById('running-editor').scrollIntoView({ block: 'start' }),
        available: (available) => {
          document.getElementById('combat-resume').hidden = !available;
        },
        ...navigation,
      },
    }),
  };
  document.getElementById('combat-resume').onclick = () => instance.revealCombat();
  return instance;
}
