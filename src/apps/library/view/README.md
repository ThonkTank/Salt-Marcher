# Library Views

Die Library rendert vier Sammlungen, die als Tabs erreichbar sind. Jede View muss eindeutig machen, welche Nutzeraufgaben im Fokus stehen und welche Datenquellen sie konsumiert.

## Gemeinsame Architektur
- `filterable-mode.ts` kapselt den Listenaufbau der Creature-Ansicht (Filter, Sortierung, Suchwertung) und dient allen anderen Tabs als Basis.
- Jede konkrete View registriert lediglich Quelle, Metadaten-Mapping, Filterdefinitionen und die Aktionsleiste der Einträge.
- Neue Ansichten erhalten so automatisch dieselben UI-Controls (Filtersektion, Sortiersteuerung, Trefferfeedback) und erben das Such-Scoring.

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

## Terrains
- Quelle: YAML-Tabelle in `SaltMarcher/Terrains.md`.
- UX-Ziele: Direkt editierbare Zeilen mit Name, Hex-Farbe, Bewegungsfaktor. Auto-Save nach 500 ms Ruhe, Inline-Spinner bei Persistenz.
- Aktionen: Hinzufügen über leere Zeile, Löschen via Kontextmenü (markiert Zeile und verschiebt Datensatz in Vault-History).
- Datenfluss: Jede Änderung sendet ein Update-Event an `library/core/sources`, das abhängige Views (Regions, Cartographer) informiert.

## Regions
- Quelle: YAML-Abschnitt in `SaltMarcher/Regions.md`, ergänzt um Referenzen auf Terrains und Encounter-Profile.
- UX-Ziele: Liste mit Name, Standardterrain, Encounter-Wahrscheinlichkeiten. Detail-Sidebar erlaubt Bearbeitung von Notizen und Verlinkungen.
- Aktionen: Öffnen im Markdown-Editor, Jump-to-Cartographer, Hinzufügen über Dialog mit Autocomplete für Terrains/Encounter.
- Datenfluss: Beim Speichern validiert die View, ob referenzierte Terrains existieren; danach wird ein Sync-Event an `apps/cartographer` geschickt.

## Items
- Quelle: Markdown-Dateien unter `SaltMarcher/Items/` mit Item-spezifischem Frontmatter.
- Filter: Kategorie (z. B. Ausrüstung, Verbrauchsgüter) und Seltenheit; letztere wird sowohl alphabetisch als auch nach D&D-Raritätenordnung sortiert.
- Aktionen: Öffnen, Import in den Editor mit direkter Übernahme der vorhandenen Datei.

## Equipment
- Quelle: Markdown-Dateien unter `SaltMarcher/Equipment/` mit Ausrüstungs-spezifischem Frontmatter.
- Filter: Typ (Weapon, Armor, Tool, Gear) und Einsatzbereich (abgeleitet aus `*_category`-Feldern wie `weapon_category`).
- Aktionen: Öffnen sowie Import über den Equipment-Editor inklusive Überschreiben der bestehenden Datei.
