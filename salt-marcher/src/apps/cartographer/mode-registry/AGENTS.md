# Ziele
- Verknüpft Editor-, Travel- und Inspector-Modi zentral mit ihren Provider-Fabriken und sorgt dafür, dass der Presenter eine konsistente Auswahl erhält.
- Normalisiert Metadaten, Fähigkeiten und Lifecycle-Hooks, bevor sie an Shell und Presenter durchgereicht werden.
- Bietet Erweiterungs-Punkte für zusätzliche Modi, ohne dass Kernprovider erneut verdrahtet werden müssen.

# Aktueller Stand
## Strukturüberblick
- `index.ts` stellt die öffentliche Registry-API bereit, registriert beim ersten Zugriff die drei Kernprovider und bietet Snapshots sowie Abo-Helfer an.
- `registry.ts` kapselt Metadaten-Normalisierung, Lazy-Loading der Provider, Listener-Benachrichtigung und Sortierung nach `order`/Label.
- `providers/` definiert konkrete Fabriken für Travel-, Editor- und Inspector-Modus und exportiert sie für `index.ts` sowie externe Aufrufer.

## Integrationspfade
- `CartographerPresenter` ruft `provideCartographerModes()` und `subscribeToModeRegistry()` auf, um Shell-Auswahl und Moduswechsel zu versorgen.
- `CartographerView` stützt sich auf `provideCartographerModes()` als Fallback, wenn Presenter-Initialisierung scheitert, und loggt Fehler.
- Tests in `tests/cartographer` verwenden `resetCartographerModeRegistry()` zum Aufräumen, um nach jedem Szenario wieder mit leeren Registrierungen zu starten.

## Beobachtungen & Risiken
- `ensureCoreProviders()` setzt die Flagge erst nach erfolgreicher Registrierung aller drei Provider. Scheitert einer der späteren Aufrufe (z.B. wegen Duplikat-IDs), bleiben zuvor registrierte Provider aktiv, Folgeaufrufe schlagen jedoch dauerhaft auf Duplicate-Errors fehl.
- `createLazyModeWrapper()` fängt Ladefehler ab und setzt den `loading`-Status zurück, meldet den Ausfall aber weder an Registry-Listener noch an Presenter/Shell. Nutzer*innen sehen lediglich Konsolen-Logs.
- Registry-Events enthalten derzeit keine Hinweise auf Provider-Gesundheit oder Laden-Status, wodurch Telemetrie und UI keine gezielten Hinweise ableiten können.

# ToDo
- [P2.47] Kernprovider-Registrierung in `ensureCoreProviders()` transaktional absichern: erfolgreiche Registrierungen bei Fehlern wieder entfernen oder gar nicht erst eintragen, damit Folgeaufrufe nicht auf Duplicate-IDs laufen.
- [P2.48] Provider-Ladefehler aus `createLazyModeWrapper()` als Registry-Event oder Telemetrie-Hook nach außen durchreichen, damit Presenter und UI sichtbares Feedback liefern können.

# Standards
- Registrierungsfunktionen beschreiben den Moduszweck im Header und dokumentieren, welche Fähigkeiten (`capabilities`) erwartet werden.
- Provider werden über eindeutige Schlüssel exportiert (`register<Modus>`), zusätzliche Provider nutzen `defineCartographerModeProvider()` zur Metadaten-Normalisierung.
- Lazy-Wrapper bleiben zustandslos, bis ein Modus geladen wurde, und räumen Fehlerpfade so auf, dass Folgeaufrufe erneut versuchen können.
