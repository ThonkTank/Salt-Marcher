# Ziele
- Stellt die Kernlogik, Apps und Integrationen des Plugins bündig dar.
- Beschreibt, wie Verantwortung und Datenflüsse zwischen den Unterordnern verteilt sind.

# Aktueller Stand
## Strukturüberblick
- `app/` initialisiert das Plugin, registriert Views und verkabelt globale Services sowie Speicher.
- `apps/` enthält die Feature-Oberflächen (Cartographer, Encounter, Library); jede Unterstruktur bringt eigene AGENTS-Dateien für Modi, Domains und Tools mit.
- `core/` stellt domänenübergreifende Datenmodelle, Persistenz- und Layoutdienste bereit, die von `app/` und allen Apps genutzt werden.
- `ui/` liefert wiederverwendbare Container, Modals, Copy-Helfer und Styling-Bausteine, die keine App-spezifischen Seiteneffekte besitzen dürfen.

## Integrations- und Datenflüsse
- Cartographer-Travel synchronisiert Begegnungen mit der Encounter-App über `apps/cartographer/modes/travel-guide/encounter-gateway` und `apps/encounter/session-store`; die Gateway-Schicht kapselt Remote-Zugriffe.
- Travel-Domänenzustand (`apps/cartographer/travel/domain`) stellt seine Typen und Speicherhüllen den Encounter-Events (`apps/encounter/event-builder`) bereit. Änderungen an den Typen erfordern abgestimmte Anpassungen in beiden Ordnern.
- Library-Editoren geben ihre Persistenz über `apps/library/core` frei, sodass neue Views denselben Datei-Pipeline-Aufbau nutzen können. Speicherschnittstellen landen zentral in `core/persistence`.
- UI-Komponenten mit App-spezifischer Logik müssen ihren Zustand in der jeweiligen App halten und dürfen nur über eindeutig benannte Props und Events mit `ui/`-Elementen sprechen.

## Arbeitsabläufe
- Builds und Tests laufen über `npm run build` bzw. `npm test` aus dem Ordnerstamm; `sync:todos` aktualisiert automatisiert die ToDo-Spiegelung in den AGENTS-Dateien.
- Neue APIs zwischen Apps und `core/` werden zunächst als Typdefinition in `core/` ergänzt, anschließend in den beteiligten App-Verzeichnissen dokumentiert.

# ToDo
- keine offenen ToDos.

# Standards
- Jeder TypeScript-Einstieg beginnt mit `// <relativer Dateipfad>` gefolgt von einem Satz Zweck. Für rein re-exportierende Dateien genügt ein Verweis auf die Quelle.
- Kommentare bleiben einzeilig und konkret; längere Erläuterungen wandern in die AGENTS- oder README-Dateien.
- Neue Apps dokumentieren ihre Schnittstellen zu bestehenden Bereichen unmittelbar in den jeweiligen AGENTS-Dateien und verlinken auf beteiligte Module.
- UI-Bausteine in `ui/` bleiben seiteneffektfrei und exportieren ausschließlich Props, die in JSDoc kommentiert sind.
