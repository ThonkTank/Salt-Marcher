# Library

Die Library bündelt alle Nachschlagewerke der Kampagne in einem Obsidian-Panel. Jede Ansicht muss klar erkennen lassen, welche Daten sie zeigt, wie sie gepflegt werden und welche Aktionen zur Verfügung stehen.

## Bedien- und UX-Ziele
- Öffne die Library über das Buch-Symbol in der Ribbon-Leiste oder per Befehl „Open Library“.
- Oben stehen vier Tabs zur Auswahl: **Creatures**, **Spells**, **Items** und **Equipment**.
- Der aktive Tab bestimmt, welche Sammlung geladen wird und welche Aktionen im Primär-Button (`Create entry`) erscheinen.
- Das Suchfeld filtert die aktuelle Liste live (case-insensitive, trimmt Leerzeichen) und bleibt zwischen Tabs getrennt gespeichert.
- Ansichten reagieren auf Vault-Änderungen: Wenn Dateien außerhalb der Library angepasst werden, aktualisieren die Tabs ihre Daten innerhalb von zwei Sekunden.

## Datenquellen & Persistenzziele
- Creatures leben als einzelne Markdown-Dateien in `SaltMarcher/Creatures/`. Jede Datei enthält Frontmatter mit `smType: creature`, Namen, Attributlisten und optionale Werteblöcke (Geschwindigkeiten, Immunitäten, Aktionen).
- Spells werden analog in `SaltMarcher/Spells/` gespeichert. Frontmatter muss `smType: spell`, einen numerischen `level` und boolesche Flags (`concentration`, `ritual`) liefern. Mehrzeilige Beschreibungen folgen nach dem Frontmatter.
- Gelände- und Regionen-Verwaltung ist in die Atlas-App ausgelagert (siehe `../atlas/README.md`).
- Alle Schreiboperationen laufen über Services in `library/core` und nutzen dieselben Datei-Pipelines, damit Caching, Fehlerbehandlung und Konfliktauflösung konsistent bleiben.

## Tab-spezifische Sollzustände
### Creatures
- Listet Kreaturen mit Name, Challenge Rating und Tags. Hover zeigt zusammengefasste Werte (HP, AC, Hauptaktionen).
- `Create entry` öffnet den Kreaturen-Editor aus `library/create/creature`, übernimmt den Suchbegriff als Vorbelegung für den Namen und fokussiert das Namensfeld.
- Aktionen: Markdown-Datei öffnen, Duplizieren (kopiert Datei mit angepasstem Namen), Löschen (Dialog mit Rückfrage, verschiebt in Obsidian-Trash).
- Datenaktualisierung: Nach dem Speichern eines Editors lädt die Liste die angepasste Datei und sortiert standardmäßig alphabetisch.

### Spells
- Zeigt Zaubername, Schule, Grad, Ritual-Flag und Konzentrationsstatus in einer Tabelle.
- Filter: Dropdown für Zauberschule, Toggle für Rituale, separate Suche im Beschreibungsfeld.
- `Create entry` startet den Spell-Editor und setzt die zuletzt gewählten Filter als Defaults im Formular.
- Persistenz: Neue Spells erhalten automatisch einen Dateinamen `Spell - <Name>.md` und landen in `SaltMarcher/Spells/`. Bestehende Dateien behalten ihre Frontmatter-Struktur.

### Items
- Listet Gegenstände mit Kategorie- und Raritätsangaben. Filter steuern beide Werte unabhängig voneinander.
- `Create entry` übernimmt den Suchbegriff als vorgeschlagenen Namen im Item-Dialog und aktualisiert die Liste nach dem Speichern automatisch.

### Equipment
- Gruppiert Ausrüstung nach Typ (Weapon, Armor, Tool, Gear) und stellt Rollensichtbarkeit über Badges dar.
- Aktionen decken Öffnen, Duplizieren und Löschen ab; der Editor übernimmt vorhandene Frontmatter-Werte.


## Event-Flow
1. Beim Öffnen lädt die Library Kernservices aus `library/core` und stellt ihnen den aktiven Vault zur Verfügung.
2. Tabs lösen Renderer in `library/view` aus, die Listen rendern, Filter anwenden und Aktionen anreichern.
3. `library/create` erzeugt neue Dateien und sendet Fertigstellungs-Events zurück an die Views, die anschließend neu laden.
4. `library/core` broadcastet Änderungsereignisse an andere Apps (z. B. Encounter oder Cartographer), damit sie verknüpfte Daten aktualisieren können.
