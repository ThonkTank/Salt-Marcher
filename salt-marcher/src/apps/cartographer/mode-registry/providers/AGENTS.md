# Ziele
- Stellt konkrete Initialisierer für jeden Cartographer-Modus bereit.

# Aktueller Stand
- Enthält Provider für Editor-, Inspector- und Travel-Guide-Flüsse.
- Tests nutzen `defineCartographerModeProvider` zusammen mit `tests/cartographer/mode-registry.test.ts` (`createStubContext`) und
  `tests/cartographer/presenter.test.ts` (`createRegistryEntry`), um Provider- und Metadata-Mocks konsistent aufzubauen.

# ToDo
- keine offenen ToDos.

# Standards
- Provider-Dateien listen zuerst ihre externen Services in einem Satz.
- Rückgaben liefern stets ein Objekt mit `activate`/`deactivate`-Signaturen.
