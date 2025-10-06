# Library Views

Die Library rendert vier Sammlungen, die als Tabs erreichbar sind. Jede View muss eindeutig machen, welche Nutzeraufgaben im Fokus stehen und welche Datenquellen sie konsumiert.

## Creatures
- Quelle: Markdown-Dateien unter `SaltMarcher/Creatures/` mit `smType: creature` im Frontmatter.
- UX-Ziele: Liste zeigt Name, Challenge Rating, Tags; Hover-Karte fasst AC, HP, Hauptaktionen zusammen.
- Aktionen: Öffnen im Editor, Duplizieren (mit Name+Suffix), Löschen (Bestätigungsdialog). `Create entry` übernimmt aktuelle Suche als Standardnamen.
- Datenfluss: Nach Änderungen durch den Editor triggert die View einen Refresh, der die Datei erneut parst und Caches in `library/core/creature-files` invalidiert.

## Spells
- Quelle: Markdown-Dateien unter `SaltMarcher/Spells/` mit `smType: spell` und `level` als Zahl.
- UX-Ziele: Tabelle mit Spalten für Schule, Grad, Casting Time, Konzentration, Ritual. Filter für Schule und Ritual, separate Suche im Beschreibungstext.
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
