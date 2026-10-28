/** Bind the real preparation instance to just its owned controls. */
export function preparationInstance(module, document, window) {
  const navigation = {
    locationNotebook: async () => {},
    roomKey: async () => false,
  };
  const editor = module.createPreparation({
    roots: ['preparation', 'world-dialog', 'location-dialog', 'note-excerpt-dialog'].map((id) =>
      document.getElementById(id),
    ),
    dialogHost: document.getElementById('preparation'),
    api: window.campaign,
    storage: window.localStorage,
    navigation: {
      locationNotebook: (...args) => navigation.locationNotebook(...args),
      roomKey: (...args) => navigation.roomKey(...args),
    },
  });
  return { ...module, ...editor, navigation };
}
