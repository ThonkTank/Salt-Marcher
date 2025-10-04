# Gesamt-ToDo-Liste

Die Aufgaben sind nach Priorität sortiert. Dezimalstellen kennzeichnen die Reihenfolge innerhalb einer Prioritätsstufe.

## 0. Fehlerbehebung
- keine offenen ToDos.

## 1. Funktionalität absichern
- keine offenen ToDos.

## 2. Robustheit & Wartbarkeit
- 2.47 [salt-marcher/src/apps/cartographer/mode-registry/AGENTS.md] Kernprovider-Registrierung in `ensureCoreProviders()` transaktional absichern: erfolgreiche Registrierungen bei Fehlern wieder entfernen oder gar nicht erst eintragen, damit Folgeaufrufe nicht auf Duplicate-IDs laufen.
- 2.47 [salt-marcher/src/apps/cartographer/mode-registry/providers/AGENTS.md] Provider-Metadaten zentralisieren (z.B. über ein gemeinsames Manifest), `metadata.source` auf die aktuellen Module (`apps/cartographer/modes/*`) aktualisieren und die `version` aus `package.json` ableiten, damit Fehlerlogs und Telemetrie konsistent bleiben.
- 2.48 [salt-marcher/src/apps/cartographer/mode-registry/providers/AGENTS.md] Persistenz-Capabilities der Registry um eine Variante für Auto-Saves erweitern, den Inspector-Provider darauf umstellen und Tests ergänzen, die `capabilities` gegen die tatsächlichen Modusmethoden validieren.
- 2.48 [salt-marcher/src/apps/cartographer/mode-registry/AGENTS.md] Provider-Ladefehler aus `createLazyModeWrapper()` als Registry-Event oder Telemetrie-Hook nach außen durchreichen, damit Presenter und UI sichtbares Feedback liefern können.
- 2.49 [salt-marcher/src/apps/cartographer/modes/AGENTS.md] Auto-Save-Timeout des Inspectors an das Abort-Signal koppeln, Fehlermeldungen im Panel darstellen und Telemetrie für `saveTile`-/`setFill`-Fehler ergänzen.
- 2.50 [salt-marcher/src/apps/cartographer/modes/AGENTS.md] Travel-Guide-Initialisierung gegen Terrain-/Logic-/Encounter-Ausfälle absichern und Nutzerhinweise + Logging vereinheitlichen.
- 2.51 [salt-marcher/src/apps/cartographer/modes/AGENTS.md] Mode-IDs, Labels und Capabilities zentralisieren, damit Modusdefinitionen und Provider-Metadaten nicht auseinanderlaufen.
- 2.52 [salt-marcher/src/apps/cartographer/modes/travel-guide/AGENTS.md] Encounter-Gateway so erweitern, dass fehlgeschlagene Module-Loads und Event-Builds Telemetrie & UI-Hinweise setzen, den Promise-Cache zurücksetzen und eine erneute Initialisierung zulassen.
- 2.53 [salt-marcher/src/apps/cartographer/modes/travel-guide/AGENTS.md] Fehlerpfade rund um `initTokenFromTiles()` und Logik-Initialisierung auffangen, Statusmeldungen im Sidebar/Overlay setzen und Nutzern Wiederholungsoptionen anbieten.
- 2.54 [salt-marcher/src/apps/cartographer/modes/travel-guide/AGENTS.md] Playback-Controls typisieren, damit Clock-/Tempo-Setter sowie `destroy()` ohne `any`-Casts adressiert werden und API-Drift früh auffällt.
- 2.55 [salt-marcher/src/apps/cartographer/travel/domain/AGENTS.md] `createTravelLogic` um `dispose()` erweitern, das Store-Subscription, Token-Adapter und Playback zuverlässig beendet.
- 2.55 [salt-marcher/src/apps/cartographer/travel/AGENTS.md] Dispose-Hook für `createTravelLogic()` bereitstellen, der Store-Subscription, Adapter-Token und Playback stoppt.
- 2.56 [salt-marcher/src/apps/cartographer/travel/AGENTS.md] `bindAdapter()` um sofortiges `draw()`/`ensurePolys` erweitern, damit frisch montierte Map-/Route-Layer den aktuellen Zustand anzeigen.
- 2.56 [salt-marcher/src/apps/cartographer/travel/domain/AGENTS.md] `bindAdapter` initiale Synchronisierung ergänzen (`ensurePolys`, `draw`, Token-Zentrierung), damit neue Render-Layer sofort den aktuellen Zustand anzeigen.
- 2.57 [salt-marcher/src/apps/cartographer/travel/domain/AGENTS.md] Fehler aus `initTokenFromTiles`/`persistTokenToTiles` über UI-/Telemetry-Hooks sichtbar machen und Wiederholungsoptionen anbieten.
- 2.57 [salt-marcher/src/apps/cartographer/travel/AGENTS.md] Persistenzfehler (`initTokenFromTiles`, `persistTokenToTiles`) mit UI-/Telemetry-Rückmeldung versehen, damit Nutzer Fehlschläge nachvollziehen können.
- 2.58 [salt-marcher/src/apps/cartographer/travel/domain/AGENTS.md] Playback an neue RenderAdapter koppeln, damit Token-Animationen nach Adapterwechsel nicht am alten Adapter hängen bleiben.
- 2.59 [salt-marcher/src/apps/cartographer/travel/infra/AGENTS.md] Playback nur pausieren, wenn ein Encounter tatsächlich geöffnet wird, oder nach unterdrückten externen Events sauber fortsetzen.
- 2.59 [salt-marcher/src/apps/cartographer/travel/domain/AGENTS.md] Token-Persistenz entkoppeln, sodass beim Schreiben nicht jede Karte geladen und gespeichert werden muss (letzten Token-Stand cachen und nur betroffene Tiles anfassen).
- 2.60 [salt-marcher/src/apps/cartographer/travel/infra/AGENTS.md] `openEncounter()` bei externen Events awaiten und Fehler bzw. Abbrüche mit Logging/Notice sichtbar machen.
- 2.61 [salt-marcher/src/apps/cartographer/travel/render/AGENTS.md] `draw-route.ts`: Fehlende Zentren (`centerOf` → `null`) als Warnung loggen und eine Wiederholungs-/`ensurePolys`-Strategie dokumentieren, damit Routenpunkte nicht stillschweigend verschwinden.
- 2.62 [salt-marcher/src/apps/cartographer/travel/render/AGENTS.md] `draw-route.ts`: Layer-Diff einführen, das bestehende Dot-/Hitbox-Elemente aktualisiert statt sie zu löschen, um Pointer-Capture und Event-Verweise während Rerenders zu erhalten.
- 2.63 [salt-marcher/src/apps/cartographer/travel/ui/AGENTS.md] Legacy-Import im Travel-Guide (`interaction-controller.ts`) auf `context-menu.controller` umstellen und den Shim `contextmenue.ts` entfernen, um den doppelten Bundle-Eintrag loszuwerden.
- 2.64 [salt-marcher/src/apps/cartographer/travel/ui/AGENTS.md] Geschwindigkeitssteuerung in `sidebar.ts` auf `input`-basierte Updates inklusive Validierungs-Helfer umbauen, damit Tempoänderungen sofort im Travel-Logic-Store landen.
- 2.65 [salt-marcher/src/app/AGENTS.md] Terrain-Bootstrap-Logger so erweitern, dass Vault-Änderungen über `watchTerrains.onError` Telemetrie- und Notice-Hooks triggern statt nur Konsolenfehler zu schreiben.
- 2.66 [salt-marcher/src/app/AGENTS.md] Terrain-Bootstrap mit `this.register` am Plugin-Lifecycle anbinden, damit `stop()` auch nach abgebrochenen `onload`-Sequenzen zuverlässig läuft.

## 3. Neue Features
- 3.2 [salt-marcher/src/apps/cartographer/travel/domain/AGENTS.md] Mehrstufige Undo/Redo-Strategien entwerfen.
- 3.3 [salt-marcher/src/apps/library/AGENTS.md] Filter-/Suchfunktionen beschreiben und später implementieren.
- 3.4 [salt-marcher/src/apps/library/create/AGENTS.md] Speicherroutinen mit Autosave ergänzen.
- 3.5 [salt-marcher/src/apps/library/create/spell/AGENTS.md] Komponenten für Ritual-spezifische Felder ergänzen.
- 3.6 [salt-marcher/src/apps/library/view/AGENTS.md] Filter- und Sortierparameter dokumentieren und implementieren.

## 4. User Experience verbessern
- 4.1 [salt-marcher/src/apps/cartographer/travel/render/AGENTS.md] Animierte Routen und Status-Indikatoren ergänzen.
- 4.2 [salt-marcher/src/apps/library/create/AGENTS.md] Validierungsfeedback konsolidieren und zentral beschreiben.
- 4.3 [salt-marcher/src/apps/library/create/creature/AGENTS.md] Spell-Ladeprozess im Modal mit Lade-/Fehlerzustand versehen.
- 4.4 [salt-marcher/src/apps/library/create/shared/AGENTS.md] Token-Editor um Drag&Drop-Upload erweitern.
- 4.5 [salt-marcher/src/apps/library/view/AGENTS.md] Regions-View um Karten-Preview erweitern.
- 4.6 [salt-marcher/src/ui/AGENTS.md] Such- und Filter-UI für größere Datenmengen erweitern.

## 5. Weitere Aufgaben
- keine offenen ToDos.
