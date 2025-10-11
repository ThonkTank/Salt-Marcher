# Library Views

Die Library rendert vier Sammlungen, die als Tabs erreichbar sind. Jede View muss eindeutig machen, welche Nutzeraufgaben im Fokus stehen und welche Datenquellen sie konsumiert.

## Gemeinsame Architektur
- `core/data-sources.ts` stellt alle filterbaren Vault-Verzeichnisse inklusive Frontmatter-Aufbereitung bereit und liefert konsistente `LibraryEntry`-Objekte für die Renderer.
- `view/filter-registry.ts` beschreibt Filter, Sortierungen und Suchfelder deklarativ pro Tab und wird von allen Listen gemeinsam verwendet.
- `view/filterable-mode.ts` kombiniert Datenquelle, Schema und UI-Rendermodule: `LibraryListState` verwaltet Filter/Sort-Status, `renderControls` erzeugt die UI, Feedback-Komponenten zeigen Fehler- und Leerezustände einheitlich an.
- `view/mode.ts` beherbergt den `LibrarySourceWatcherHub`, der Dateisystem-Events pro Quelle bündelt und Mehrfach-Abos verhindert.
- Konkrete Views liefern nur noch ihre Eintragsdarstellung und Tab-spezifische Aktionen (z. B. Import-Dialoge); das restliche Verhalten kommt aus dem Basismodus.

## Creatures
- Quelle: Markdown-Dateien unter `SaltMarcher/Creatures/` mit `smType: creature` im Frontmatter.
- UX-Ziele: Liste zeigt Name, Challenge Rating, Tags; Hover-Karte fasst AC, HP, Hauptaktionen zusammen.
- Filter: Kreaturentyp und Challenge Rating; beide stehen auch für Sortierung bereit.
- Aktionen: Öffnen im Editor, Duplizieren (mit Name+Suffix), Löschen (Bestätigungsdialog). `Create entry` übernimmt aktuelle Suche als Standardnamen.
- Datenfluss: Nach Änderungen durch den Editor triggert die View einen Refresh, der die Datei erneut parst und Caches in `library/core/creature-files` invalidiert.

## Spells
- Quelle: Markdown-Dateien unter `SaltMarcher/Spells/` mit `smType: spell` und `level` als Zahl.
- UX-Ziele: Tabelle mit Spalten für Schule, Grad, Casting Time, Konzentration, Ritual. Filter für Schule und Grad nutzen die gemeinsame Controls-Sektion.
- Aktionen: Öffnen, Editor mit vorausgefüllten Feldern, Export in Clipboard (Markdown-Snippet).
- Datenfluss: Neue Zauber erhalten Dateinamen `Spell - <Name>.md`; beim Speichern validiert die View Frontmatter-Struktur und zeigt Fehlerhinweise inline.

## Atlas-Abspaltung
- Die früheren Terrains- und Regions-Renderer sind in die Atlas-App umgezogen (`../atlas/view/terrains.ts` bzw. `../atlas/view/regions.ts`).
- Library-Tabs fokussieren sich dadurch ausschließlich auf dateibasierte Nachschlagewerke mit Filter-Unterstützung.

## Items
- Quelle: Markdown-Dateien unter `SaltMarcher/Items/` mit Item-spezifischem Frontmatter.
- Filter: Kategorie (z. B. Ausrüstung, Verbrauchsgüter) und Seltenheit; letztere wird sowohl alphabetisch als auch nach D&D-Raritätenordnung sortiert.
- Aktionen: Öffnen, Import in den Editor mit direkter Übernahme der vorhandenen Datei.

## Equipment
- Quelle: Markdown-Dateien unter `SaltMarcher/Equipment/` mit Ausrüstungs-spezifischem Frontmatter.
- Filter: Typ (Weapon, Armor, Tool, Gear) und Einsatzbereich (abgeleitet aus `*_category`-Feldern wie `weapon_category`).
- Aktionen: Öffnen sowie Import über den Equipment-Editor inklusive Überschreiben der bestehenden Datei.

## Architekturbausteine
- **Wiederverwendbare Datenpipelines**: `core/data-sources.ts` extrahiert Frontmatter-Felder, normalisiert Werte (z. B. Spell-Level) und kapselt die Watcher aus den jeweiligen `*-files`-Modulen.
- **Deklarative Filter-Schemata**: `filter-registry.ts` enthält die komplette Konfiguration von Filtern, Sortierungen und Suchfeldern; neue Tabs müssen lediglich eigene Schemaeinträge ergänzen.
- **Komponierter Renderer**: `filterable-mode.ts` trennt Zustandsverwaltung, DOM-Aufbau und Feedback-Handling und stellt Hilfsmethoden wie `reloadEntries` bereit, damit Aktionsdialoge ohne Boilerplate neu rendern können.
- **Zentraler Watcher-Hub**: `mode.ts` aggregiert Dateiänderungen pro Quelle, wodurch parallele Views denselben Watcher teilen und Listen nur noch einmal pro Änderung neu geladen werden.
- **Standardisiertes Feedback**: Fehler- und Leerezustände erscheinen über `sm-cc-feedback`-Blöcke mit einheitlicher Gestaltung; Anpassungen erfolgen dadurch zentral.
