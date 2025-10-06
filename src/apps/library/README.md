# Library

Die Library bündelt alle Nachschlagewerke der Kampagne in einem Obsidian-Panel. Jede Ansicht muss klar erkennen lassen, welche Daten sie zeigt, wie sie gepflegt werden und welche Aktionen zur Verfügung stehen.

## Bedien- und UX-Ziele
- Öffne die Library über das Buch-Symbol in der Ribbon-Leiste oder per Befehl „Open Library“.
- Oben stehen vier Tabs zur Auswahl: **Creatures**, **Spells**, **Terrains** und **Regions**.
- Der aktive Tab bestimmt, welche Sammlung geladen wird und welche Aktionen im Primär-Button (`Create entry`) erscheinen.
- Das Suchfeld filtert die aktuelle Liste live (case-insensitive, trimmt Leerzeichen) und bleibt zwischen Tabs getrennt gespeichert.
- Ansichten reagieren auf Vault-Änderungen: Wenn Dateien außerhalb der Library angepasst werden, aktualisieren die Tabs ihre Daten innerhalb von zwei Sekunden.

## Datenquellen & Persistenzziele
- Creatures leben als einzelne Markdown-Dateien in `SaltMarcher/Creatures/`. Jede Datei enthält Frontmatter mit `smType: creature`, Namen, Attributlisten und optionale Werteblöcke (Geschwindigkeiten, Immunitäten, Aktionen).
- Spells werden analog in `SaltMarcher/Spells/` gespeichert. Frontmatter muss `smType: spell`, einen numerischen `level` und boolesche Flags (`concentration`, `ritual`) liefern. Mehrzeilige Beschreibungen folgen nach dem Frontmatter.
- Terrains werden in `SaltMarcher/Terrains.md` als YAML-Tabelle gepflegt. Jede Zeile hält Name, Farbcode und Bewegungskosten. Änderungen müssen ohne expliziten „Save“-Button persistieren.
- Regions verwalten wir in `SaltMarcher/Regions.md`. Einträge verbinden Name, Standardterrain, optionale Encounter-Profile und zusätzliche Hinweise.
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

### Terrains
- Rendert eine Liste editierbarer Zeilen mit Name, Hex-Farbe (Color-Picker) und Bewegungsfaktor. Jede Zeile validiert Eingaben sofort (z. B. hexadezimale Farbe, numerische Bewegung).
- UX-Ziel: Änderungen werden nach 500 ms Inaktivität gespeichert und visuell mit einem Inline-Spinner quittiert. Fehler werden inline an der betroffenen Zelle angezeigt.
- Datenpflege: Automatisch sortiert nach Terrain-Namen. Neue Zeilen entstehen durch `Enter` am Ende der Tabelle.

### Regions
- Kombiniert Regionen mit Terrains; zeigt zusätzlich Encounter-Wahrscheinlichkeiten und optionale Notizen.
- `Create entry` öffnet einen In-Place-Dialog, der bestehende Terrains zur Auswahl anbietet und Encounter-Profile aus dem Encounter-Modul referenziert.
- Validierung: Referenzen auf Terrains und Encounter müssen existieren, ansonsten bleibt das Speichern deaktiviert und zeigt einen Hinweis.
- Datenfluss: Änderungen synchronisieren sich mit Cartographer-Funktionen, indem `library/core` eine Benachrichtigung an `apps/cartographer` sendet.

## Event-Flow
1. Beim Öffnen lädt die Library Kernservices aus `library/core` und stellt ihnen den aktiven Vault zur Verfügung.
2. Tabs lösen Renderer in `library/view` aus, die Listen rendern, Filter anwenden und Aktionen anreichern.
3. `library/create` erzeugt neue Dateien und sendet Fertigstellungs-Events zurück an die Views, die anschließend neu laden.
4. `library/core` broadcastet Änderungsereignisse an andere Apps (z. B. Encounter oder Cartographer), damit sie verknüpfte Daten aktualisieren können.
