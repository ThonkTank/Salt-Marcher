# Encounter

Der Encounter-Arbeitsbereich sammelt Reiseereignisse und hilft, laufende Begegnungen zu dokumentieren.

## Öffnen
- Lasse in Obsidian ein rechtes Paneel frei; sobald der Cartographer im Travel-Modus eine Begegnung auslöst, öffnet sich der Encounter automatisch dort.
- Alternativ kannst du den Bereich manuell im Layout fixieren: `cmd/ctrl + P` → „Encounter“ eingeben.

## Oberfläche verstehen
- **Titel & Status**: Zeigt Region und aktuellen Fortschritt (wartend, offen, erledigt).
- **Zusammenfassung**: Listet Herkunft, Terrains, Gefahrenstufe und andere Details des Ereignisses.
- **Notes**: Eingabefeld für Initiative, Taktik oder Nachbereitung. Änderungen werden sofort im Encounter-Zustand gespeichert.
- **Mark encounter resolved**: Beende eine Begegnung und friere das Log ein. Der Button wird nach Abschluss deaktiviert.

## Workflow
1. Starte eine Reise im Cartographer (Travel-Modus).
2. Sobald ein Encounter ausgelöst wird, füllt sich der Bereich automatisch.
3. Ergänze Notizen während der Begegnung.
4. Schließe die Begegnung mit „Mark encounter resolved“, um sie später nachzulesen.

## XP-Verwaltung
1. Trage unter **Encounter XP** den Basiswert der Begegnung ein – negative Eingaben werden automatisch auf 0 gesetzt.
2. Füge unter **Party** alle Spielercharaktere hinzu. Level unter 1 werden angehoben, XP-Werte unter 0 korrigiert.
3. Nutze das Kontextmenü der Charakterzeilen zum Aktualisieren oder Entfernen, ohne dass vorhandene Regelberechnungen verloren gehen.

## Regel-Editor
- Klicke auf **Add Rule**, um Hausregeln oder Loot-Boni abzubilden.
- Wähle den Scope:
  - **Overall** verteilt flache oder prozentuale Anpassungen auf die gesamte Party.
  - **Per Player** berechnet Effekte individuell auf Basis der jeweiligen Charakterdaten.
- Bestimme den Modifikatortyp:
  - **Flat** addiert/abzieht einen festen Wert.
  - **% Total** skaliert mit dem kumulierten Ergebnis aller vorherigen Regeln.
  - **% Next Level** nutzt den Abstand zur nächsten D&D-Schwelle des Charakters.
- Regeln lassen sich per Toggle deaktivieren oder über Drag & Drop (bzw. Auf/Ab-Buttons) neu sortieren.
- Notizen erscheinen im Breakdown und dokumentieren Sonderfälle für spätere Sessions.

## Ergebnis-Breakdown lesen
- Die **Party-Tabelle** zeigt Basis-XP, Modifikatoren-Summe und verbleibende XP bis zum nächsten Level.
- Warnungen heben fehlende Schwellen (z. B. bei Level-20-Charakteren) oder fehlende Party-Einträge hervor.
- Die **Regel-Liste** listet pro Eintrag den Beitrag zur Gesamtverteilung auf, inklusive Warnhinweisen bei ungültigen Eingaben.
- Unter **Total Encounter XP** findest du die Summe aller berechneten Werte – ideal für Copy & Paste in dein Session-Log.

## Event-Flow
1. `cartographer/modes/travel-guide/encounter-gateway` publiziert neue Ereignisse im Encounter-Store.
2. `encounter/presenter.ts` transformiert sie für die UI, pflegt Status und erlaubt das Schließen.
3. `encounter/view.ts` zeigt den aktuellen Status an, schreibt Notizen zurück in den Store und meldet Abschlussmeldungen an Obsidian.
