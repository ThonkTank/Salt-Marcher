Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: German owner smoke checklists for architecture migration area
close-out under `docs/project/architecture/architecture-migration-roadmap.md`.

# Architektur-Migration Owner-Smoke-Checklisten

## Zweck

Diese Checklisten sind kurze deutsche Rauchtests fuer Owner-Feedback nach
einer migrierten Area oder Dungeon-Teilscheibe. Sie ersetzen keine Harnesses,
blockieren keine Pipeline und fuehren kein neues Produktverhalten ein.
Auffaelligkeiten werden als normale R2-Anomalien oder, bei schwerer Drift, ueber
den im Ledger beschriebenen Revert-Pfad behandelt.

## Nutzung

- Nur die Checkliste der zuletzt abgeschlossenen Area ausfuehren.
- Vorher den zugehoerigen deutschen Statushinweis im Ledger lesen.
- Keine Vergleichsdaten reparieren oder neu anlegen, nur sichtbares Verhalten
  pruefen.
- Sichtbare Abweichungen mit Area-Namen, Schritt und kurzer Beobachtung melden.

## `hex`

- App starten und den linken Tab `Hex-Karte` oeffnen.
- Eine neue Hex-Karte anlegen und pruefen, dass sie sofort sichtbar ist.
- Kartennamen und Radius aendern und die sichtbare Karte erneut oeffnen.
- Ein Terrain-Werkzeug waehlen und ein Feld sichtbar anders faerben.
- Dasselbe Feld mit `Auswahl` anklicken und Koordinate/Terrain im Status lesen.
- Einen Marker mit Name, Typ und Notiz speichern.
- Eine Reisegruppe auf ein Hex-Feld setzen und mit dem Werkzeug bewegen.
- Zum Tab `Reise` wechseln und Ort, Status, Kontext, Wetter/Zeit/Tempo lesen.
- App neu starten und Karte, Terrain und Marker erneut oeffnen.
- Keine neue Warnung, kein leerer Hauptbereich und kein verlorener Marker.

## `worldplanner`

- App starten und den World-Planner-Bereich oeffnen.
- Bestehende NPC-, Fraktions- und Ortslisten durchsehen.
- Einen NPC anlegen, umbenennen und wieder auswaehlen.
- Eine Fraktion anlegen und eine Beziehung oder Notiz sichtbar pruefen.
- Einen Ort anlegen und pruefen, dass Referenzen angezeigt werden.
- Filter- oder Suchfelder benutzen und danach die Auswahl wiederherstellen.
- Eine Begegnung aus World-Planner-Daten vorbereiten.
- Zurueck zum World Planner wechseln und die Ursprungsdaten erneut lesen.
- App neu starten und die angelegten Eintraege wiederfinden.
- Keine vertauschten Namen, leeren Listen oder verlorenen Referenzen.

## `creatures`

- App starten und den Kreaturenkatalog oeffnen.
- Einen vorhandenen Kreatureneintrag oeffnen und Details lesen.
- Einen neuen Kreatureneintrag mit Name und Kernwerten anlegen.
- Den Eintrag bearbeiten und die Aenderung in der Liste wiederfinden.
- Such- oder Filtereingaben benutzen und wieder loeschen.
- Einen Detailwert aendern und erneut oeffnen.
- Einen Kreatureneintrag in einer Begegnungsauswahl sichtbar verwenden.
- App neu starten und den Eintrag im Katalog wiederfinden.
- Fehlertexte bei unvollstaendigen Pflichtwerten sichtbar pruefen.
- Keine doppelten, verschwundenen oder falsch gefilterten Kreaturen.

## `party`

- App starten und den Party- oder Charakterbereich oeffnen.
- Einen Charakter anlegen und als aktiv markieren.
- Den Charakter zwischen aktiv und Reserve verschieben.
- Die Party-Auswahl oder Dropdown-Anzeige oeffnen.
- Aktive Mitglieder in Trigger und Inhalt vergleichen.
- Eine Reiseposition mit der aktiven Party benutzen.
- Die Anzeige nach einer Mitgliederaenderung erneut oeffnen.
- App neu starten und aktive/reservierte Mitglieder wieder pruefen.
- Ungueltige oder leere Auswahl sichtbar abfangen.
- Keine verlorenen aktiven Mitglieder oder falschen Dropdown-Labels.

## `sessionplanner`

- App starten und den Session Planner oeffnen.
- Eine neue Session anlegen und umbenennen.
- Die Session aus der Liste auswaehlen und wieder oeffnen.
- Szenen oder Timeline-Eintraege anlegen.
- Teilnehmer oder Platzhalter sichtbar pruefen.
- Loot- oder Notizfelder ohne Layoutsprung benutzen.
- Zwischen anderen Tabs wechseln und zur Session zurueckkehren.
- App neu starten und die Session erneut laden.
- Eine Session loeschen oder wechseln und die Liste pruefen.
- Keine verlorene Auswahl, leere Timeline oder verdeckte Controls.

## `encountertable`

- App starten und den Encounter-Table-Bereich oeffnen.
- Eine vorhandene Tabelle auswaehlen und Zusammenfassung lesen.
- Eine neue Tabelle mit Namen und Kandidaten anlegen.
- Gewichtete Kandidaten bearbeiten und sichtbar wiederfinden.
- Eine leere oder unvollstaendige Auswahl pruefen.
- XP- oder Schwierigkeitsgrenze einstellen.
- Die Tabelle in einer Begegnungsquelle verwenden.
- App neu starten und Tabelle plus Kandidaten erneut lesen.
- Fehler- oder Leerzustand bei ungueltigen Daten sichtbar pruefen.
- Keine falschen Gewichte, verlorenen Kandidaten oder leeren Namen.

## `encounter`

- App starten und den Encounter-Bereich oeffnen.
- Einen Begegnungsentwurf erzeugen.
- Kreaturen, Tabelle und Weltbezug im Entwurf lesen.
- Den Entwurf speichern oder als Plan uebernehmen.
- Zum State-Tab fuer Begegnungen wechseln und Status lesen.
- Einen gespeicherten Plan erneut auswaehlen.
- Eine Session- oder Szenenuebernahme sichtbar pruefen.
- App neu starten und den gespeicherten Plan wiederfinden.
- Leere Zustaende und Fehlertexte sichtbar pruefen.
- Keine verlorenen Kreaturen, falschen Statuslabels oder leere State-Tabs.

## `dungeon-authored-core`

- App starten und den Dungeon Editor oeffnen.
- Eine bestehende Dungeon-Karte laden.
- Raum, Wand, Tuer, Korridor, Treppe und Uebergang sichtbar pruefen.
- Einen kleinen Raum oder eine Wand bearbeiten.
- Eine Tuer oder einen Marker auswaehlen und Details lesen.
- Eine gueltige Kernstruktur speichern.
- Eine ungueltige Kernaktion ausloesen und sichtbare Ablehnung pruefen.
- App neu starten und die Karte erneut laden.
- Benachbarte Strukturen nach der Aenderung erneut ansehen.
- Keine verschobenen IDs, verlorenen Komponenten oder falschen Auswahlen.

## `dungeon-editor-session-runtime`

- App starten und den Dungeon Editor oeffnen.
- Eine Karte laden und Editor-Steuerung, Hauptkarte und Statusbereich sehen.
- Zwischen Auswahl, Wand, Raum, Tuer, Korridor, Treppe und Feature wechseln.
- Eine Auswahl auf der Karte setzen und im Statusbereich lesen.
- Einen Editor-Entwurf speichern und erneut auswaehlen.
- Eine sichtbare Warnung oder Fehlermeldung bewusst pruefen.
- Zwischen Dungeon Editor und anderem Tab wechseln.
- App neu starten und die Editor-Session erneut laden.
- Letzte Auswahl, sichtbare Karte und Katalog vergleichen.
- Keine leere Karte, kein falsches Werkzeug und kein verlorener Entwurf.

## `dungeon-travel`

- App starten und eine Dungeon-Reise- oder Projektionsansicht oeffnen.
- Eine Dungeon-Session mit Karte und Level laden.
- Sichtbare Level- oder Projektionssteuerung bedienen.
- Die Reisegruppe auf der Dungeon-Karte sichtbar pruefen.
- Einen gueltigen Uebergang oder Levelwechsel ausloesen.
- Einen ungueltigen oder nicht verknuepften Uebergang pruefen.
- Zum globalen `Reise`-State-Tab wechseln und Status lesen.
- Zur Dungeon-Ansicht zurueckkehren und Position vergleichen.
- App neu starten und die Session erneut laden.
- Keine Autorendaten veraendern, keine verlorene Position, kein falsches Level.

## `dungeon-rendering-pipeline`

- App starten und eine bekannte Dungeon-Karte oeffnen.
- Uebersicht, Waende, Raeume, Tueren und Korridore visuell vergleichen.
- Ausgewaehlte Elemente markieren und Markierung beobachten.
- Hover oder Vorschau ueber mehrere Zieltypen bewegen.
- Treppen, Uebergaenge, Features und Labels sichtbar pruefen.
- Zwischen Leveln oder Projektionen wechseln.
- Eine Reisegruppe oder Actor-Layer sichtbar pruefen.
- Fenster groesser und kleiner ziehen.
- App neu starten und dieselbe Karte erneut oeffnen.
- Keine fehlenden Kanten, falschen Farben, Geistermarker oder leere Canvas.

## `dungeon-editor-view`

- App starten und den Dungeon Editor oeffnen.
- Controls, Hauptkarte und Statusbereich gleichzeitig sehen.
- Ein Werkzeug wechseln und die sichtbare Werkzeuganzeige pruefen.
- Karte anklicken, Auswahl lesen und wieder loeschen.
- Einen Raum, eine Wand oder einen Korridor ueber die UI bearbeiten.
- Marker, Treppe, Tuer oder Uebergang im Statusbereich pruefen.
- Katalogauswahl wechseln und zur Karte zurueckkehren.
- App neu starten und dieselbe Editor-Ansicht oeffnen.
- Tastbare Controls ohne Ueberlappung oder abgeschnittenen Text pruefen.
- Keine falsche Auswahl, kein verdecktes Panel und keine verlorene UI-Aktion.

## `remaining-view-and-shell`

- App starten und die Shell mit linken Tabs und State-Tabs pruefen.
- Einen Katalog oeffnen, filtern, neu anlegen und abbrechen.
- Shared Search/Filter-Controls mit leerem und gefuelltem Ergebnis testen.
- Party-Dropdown oeffnen und aktive Mitglieder lesen.
- `Reise`- und `Begegnung`-State-Tabs mit leerem Zustand oeffnen.
- Zwischen mehreren Tabs wechseln und Layoutstabilitaet beobachten.
- App neu starten und Startzustand plus letzte Daten pruefen.
- Ein Popup oeffnen und ausserhalb klicken.
- Kleine Fensterbreite pruefen, ohne Textueberlappung zu akzeptieren.
- Keine leeren Shell-Slots, abgeschnittenen Popups oder falschen Tab-Inhalte.
