# UI terminology consistency

## Original Finding
> Namensgebung und Kommentare wechseln zwischen Englisch und Deutsch (z. B. englische Fehlermeldungen neben deutschsprachigen Notices), was Konsistenz und Lesbarkeit beeinträchtigt.
>
> **Empfohlene Maßnahme:** UI-Texte und Kommentare sollten konsequent in einer Sprache gehalten werden, um Mischformen wie in `MapManager` und `LibraryView` zu vermeiden.

Quelle: [`architecture-critique.md`](../architecture-critique.md).

## Bestandsaufnahme

### Map-Verwaltung (Header, Manager, Workflows, Confirm Delete)
- **Screens/Flows:** Cartographer-Header, Map-Editor-Header, Map-Löschdialog und allgemeine Map-Verwaltung (öffnen/anlegen/löschen) greifen auf `createMapHeader`, `createMapManager`, `promptMapSelection`, `promptCreateMap` und `ConfirmDeleteModal` zu.
- **UI-Texte:**
  - `createMapHeader` mischt englische Labels (`"Open Map"`, `"Create"`, `"Delete"`) mit deutschen Defaults (`"Speichern"`, `"Speichern als"`, `"Los"`, Notices `"Keine Karte ausgewählt."`, `"Gespeichert."`, `"Speichern fehlgeschlagen."`) sowie einem deutschen Placeholder für das Such-Dropdown (`enhanceSelectToSearch(..., 'Such-dropdown…')`).
  - `createMapManager` nutzt englische Notices (`"No map selected."`, `"Could not delete the map. Check the console for details."`).
  - `promptMapSelection` und `promptCreateMap` zeigen deutsche Notices (`"Keine Karten gefunden."`, `"Karte erstellt."`), während die begleitenden Kommentare deutschsprachig sind.
  - `ConfirmDeleteModal` präsentiert rein englische Texte (`"Delete map?"`, Warnhinweis, Buttons `"Cancel"`/`"Delete"`, Notices `"Map deleted."`/`"Deleting map failed."`).
- **Kommentare/Docstrings:** Innerhalb derselben Dateien wechseln Kommentare häufig zwischen englischen Beschreibungen (z. B. Funktionskopf in `map-manager.ts`) und deutschen Erläuterungen (z. B. Default-Beschreibungen in `map-workflows.ts`).
- **Risiken:** Unterschiedliche Sprachwahl innerhalb eines Dialogflusses macht Übersetzungsarbeit kompliziert, erschwert QA-Skripte (Screenshot-basierte Tests) und führt zu Support-Tickets wegen widersprüchlicher Terminologie.

### Library View & abhängige Renderer
- **Screen:** Library-Hauptansicht (`LibraryView`) samt Mode-Schaltern (`Creatures`, `Spells`, `Terrains`, `Regions`), Suchfeld, Create-Button und Quellenbeschreibung.
- **UI-Texte:** Alle sichtbaren Labels sind englisch (`"Library"`, `"Search or type a name…"`, `"Create"`, Modus-Labels), während Kommandonamen im Obsidian-Command-Palette-Metadaten teilweise deutsch sind (`"Library öffnen"`).
- **Kommentare:** Datei nutzt englische Kommentare für Struktur, im Gegensatz zu deutschsprachigen Kommentaren in den zugehörigen Renderer-Dateien (`describeTerrainsSource` etc.).
- **Risiken:** Unterschiedliche Sprache zwischen Command-Registrierung und sichtbarer View führt zu Inkonsistenzen in Dokumentation und Onboarding (z. B. How-Tos nennen gemischte Begriffe).

### Globale Plugin-Einstiegspunkte
- **Betroffene Stellen:** Ribbon-Icons und Commands in `salt-marcher/src/app/main.ts` verwenden englische Ribbons (`"Open Cartographer"`, `"Open Library"`) bei gleichzeitig deutsch benannten Commands (`"Cartographer öffnen"`, `"Library öffnen"`).
- **Risiko:** Nutzer:innen, die sich am Command-Palette-Text orientieren, sehen eine andere Terminologie als in Ribbon-Tooltips oder UI-Kopfzeilen.

### Gemeinsame Modals & Utilities
- `NameInputModal` und `MapSelectModal` liefern ausschließlich deutschsprachige Defaults (`"Neue Hex Map"`, `"Name der neuen Karte"`, `"Erstellen"`, `"Karte suchen…"`).
- `enhanceSelectToSearch` setzt den Standard-Placeholder `"Suchen…"`.
- Kommentare in `modals.ts` und `search-dropdown.ts` sind deutsch, obwohl die Komponenten in englischsprachigen Views eingebunden sind.

### Dokumentation & Style Guide
- Der projektweite [`style-guide.md`](../style-guide.md) fordert bereits: „Runtime UI copy (…) muss Englisch verwenden“. Der aktuelle Code verletzt diese Vorgabe mehrfach (siehe oben) und deckt nur einzelne Strings ab – eine zentrale Terminologie-Liste fehlt.

## Offene Recherchefragen & Abstimmungen
1. **Verbindliche Sprache bestätigen:** Style Guide legt Englisch fest – trotzdem Rücksprache mit Produkt/Localization-Team einplanen, um sicherzustellen, dass keine Deutsch-lokalisierte Zielgruppe bedient werden muss.
2. **Terminologie-Lexikon:** Gibt es bereits (intern/extern) eine verbindliche Liste von Begriffen für Map-, Library- und Cartographer-Funktionen? Falls nicht, mit UX & Tech Writing abstimmen.
3. **Kommentar-Sprache:** Sollen Code-Kommentare und Docstrings ebenfalls konsequent Englisch sein oder darf es hier zweisprachige Erklärungen geben (z. B. für Legacy-Hinweise)? Entscheidung dokumentieren.
4. **Test- und Lint-Support:** Welche Tooling-Präferenzen bestehen? (ESLint-Rule, Vitest-Snapshot, Custom-Script). Abstimmung mit DevOps, um bestehende Pipelines nicht zu destabilisieren.
5. **Kommunikation mit Dokumentationsteam:** Prüfen, ob User-Wiki/README-Verweise bereits auf die gemischten Begriffe Bezug nehmen und ggf. Korrektur-PRs koordinieren.

## Aktionsplan inkl. Evaluation
1. **Sprache festzurren und dokumentieren**
   - Review von `style-guide.md` mit UX/Product bestätigen; Ergebnis im Style Guide (oder ergänzendem Glossar) festhalten.
   - **Evaluation:** Abnahmeprotokoll (Kurznotiz im PR, Verweis auf bestätigte Entscheidung) + Review-Checkliste-Eintrag „UI copy verified against language policy“.
2. **Terminologie-Lexikon aufbauen**
   - Alle UI-Strings aus den identifizierten Dateien extrahieren, gewünschte englische Formulierungen definieren, ggf. zentrale Konstanten vorbereiten.
   - **Evaluation:** Glossar-Dokument (z. B. in `wiki/` oder `docs/ui/`) + Cross-Check mit UX-Team; Peer-Review bestätigt Vollständigkeit.
3. **Code-Kommentare und Notices vereinheitlichen**
   - In `map-header.ts`, `map-manager.ts`, `map-workflows.ts`, `confirm-delete.ts`, `modals.ts`, `search-dropdown.ts`, `app/main.ts` usw. Kommentare/Docstrings in die gewählte Sprache übertragen; UI-Strings angleichen (z. B. alle Notices englisch).
   - **Evaluation:**
     - Lint/Script: `rg "[äöüÄÖÜß]" salt-marcher/src` muss keine UI-relevanten Dateien mehr liefern (nur erlaubte Legacy-Kommentare).
     - Manuelle QA: Screenshots / Walkthrough aller Map-Verwaltungsflows + Library, um sichtbare Texte zu überprüfen.
4. **Centralize copy management**
   - Optionales `ui-copy.ts` oder JSON-Resource erstellen, damit Labels zentral gepflegt werden; Map-Header/Manager/Modals beziehen Texte daraus.
   - **Evaluation:** Unit-/Integrationstest, der das Copy-Objekt validiert (z. B. Snapshot-Test) + ESLint-Rule/Custom Script, das unerwartete Literal-Strings in UI-Ebene flaggt.
5. **Review-Checkliste & Tooling erweitern**
   - Checklisteintrag im PR-Template oder Entwickler-Dokumentation ergänzen: „UI copy reviewed for English terminology“.
   - ESLint-Regel oder Vitest/CI-Skript implementieren, das deutschsprachige Umlaute/Keywords in UI-Verzeichnissen identifiziert.
   - **Evaluation:** CI-Lauf, der bewusst deutschsprachigen String (z. B. in Testbranch) blockiert → Nachweis, dass Rule greift.
6. **Regression-Tests & Release-Notes**
   - Manuelle Smoke-Tests (Map öffnen/anlegen/löschen, Library-Suche, Ribbon- und Command-Aufruf) nach String-Refactor ausführen.
   - Release-Notes/Changelog-Eintrag vorbereiten, der die Terminologie-Bereinigung ankündigt, damit Support & Docs synchronisieren können.
   - **Evaluation:** Testprotokoll (QA-Checkliste abgezeichnet) + Review der Release-Notes durch Tech Writing.

## Referenzen
- Map Manager: [`salt-marcher/src/ui/map-manager.ts`](../salt-marcher/src/ui/map-manager.ts)
- Map Header: [`salt-marcher/src/ui/map-header.ts`](../salt-marcher/src/ui/map-header.ts)
- Map Workflows: [`salt-marcher/src/ui/map-workflows.ts`](../salt-marcher/src/ui/map-workflows.ts)
- Confirm Delete Modal: [`salt-marcher/src/ui/confirm-delete.ts`](../salt-marcher/src/ui/confirm-delete.ts)
- Library View: [`salt-marcher/src/apps/library/view.ts`](../salt-marcher/src/apps/library/view.ts)
- Plugin Entry: [`salt-marcher/src/app/main.ts`](../salt-marcher/src/app/main.ts)
- Modals & Search Dropdown: [`salt-marcher/src/ui/modals.ts`](../salt-marcher/src/ui/modals.ts), [`salt-marcher/src/ui/search-dropdown.ts`](../salt-marcher/src/ui/search-dropdown.ts)
- Style Guide: [`style-guide.md`](../style-guide.md)
