# XP-Korrektur und getrennte Abrechnung

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## XP-Korrektur und getrennte Abrechnung

Die aktuelle `requirements-party-window.md`, gleiche Quellrevision wie oben,
Hash `e02994fea23b879f478de2b6656aff88f0b79d048a608785ff61f09829569395`,
L31–48, ersetzt ausdrücklich die historischen Dropdownregeln: XP dürfen bis
null sinken, das Level wird dabei neu abgeleitet. Manuelle XP verändern weder
Long-/Short-Verbrauch noch A/k. Das Levelminimum begrenzt nur die grafische
Levelanzeige. Es ist keine Untergrenze für Korrekturen.

Der zuletzt ergänzte `party-xp-model.ts.changeCharacterXp` hatte die alte
Leveluntergrenze wieder eingeführt und negative Korrekturen auch von Long-/
Short-Verbrauch und A abgezogen. Gegenbeispiel: 1.000 XP mit 240 bestätigten
Belastungs-XP, früher kurzer Rast und weiteren 100 Belastungs-XP. Ein Abzug von
950 muss 50 XP / Level 1 ergeben; Longverbrauch 340, Shortverbrauch 100, A=240
und k=1 bleiben erhalten. Das kleinere aktuelle Budget 300 ist damit bereits
überzogen. Verbrauch zu löschen würde die nötige lange Rast verstecken.

Der gemeinsame Rechner begrenzt Abzüge jetzt ausschließlich auf null und
bewahrt alle Rastfakten. Party- und Charaktervorschau erklären die gleiche
Wirkung wie `executeProgress`; „Setzen“ und „Hinzufügen“ erhalten ebenfalls
Verbrauch und A/k. Ein unbekannter XP-Stand erlaubt weiterhin keinen Abzug;
ein ausdrückliches Setzen schafft die XP-Basis ohne eine Rast zu erfinden.
Keine Migration: bestehende bestätigte Fakten werden nicht nachträglich aus
früheren Awards rekonstruiert oder umgeschrieben.

Die neue `party-award`-Abrechnung verteilt Verdienst und Tagesbelastung mit
getrennten Empfängerlisten und gemeinsamer Aufrundung. Sie prüft Roster-,
Mitgliedschafts- und Fortschrittsrevisionen; Belastung benötigt aktive Figuren,
Verdienst kann ausdrücklich Reservefiguren erreichen. Belastung allein erzeugt
keine bekannte XP-Basis. `party-award-member` hält damalige Vorher-/Nachherwerte;
ein späterer manueller XP-Command mit `correctionOf` hängt einen eigenen Eintrag
an. Er ändert weder den referenzierten Award noch dessen Belastungsfakten.

Vier Fälle in `tests/runtime/desktop-xp-rest-corrections.test.mjs` prüfen den echten Store:
Abwärtskorrektur über Levelgrenzen bis null, erhaltene frühe/zweite/zusätzliche
Shortsections und Longreset, Vorschau/Writer-Gleichheit, unveränderte verlinkte
Herkunft, Replay ohne zweite Wirkung und Fresh. Belastung ohne bekannte XP und
Rollback der ersten Teilnehmerwirkung bei einem späteren stale Empfänger sind
getrennte Gegenproben. Eine tatsächliche Party-DOMvorschau zeigt den Abzug und
erklärt erhaltenen Verbrauch. Diese kontrollierten Fälle ersetzen keine native
XP-/Rast-/Abrechnungsabnahme.

Die direkten Abrechnungs-/Copyprüfungen stehen in
[desktop-party-xp.test.mjs](../../../tests/runtime/desktop-party-xp.test.mjs),
späte Speicherbestätigungen in
[desktop-party-award-dom.test.mjs](../../../tests/runtime/desktop-party-award-dom.test.mjs).

## Lokale Belege und Grenzen

Neun Fälle in `tests/runtime/desktop-day-calculator.test.mjs` verwenden den echten Store,
den echten Rechner und die tatsächliche HTML-/UIoberfläche in Linkedom:

- beschädigter inaktiver Fortschritt blockiert die gesunde Party nicht;
  beschädigter benötigter aktiver Fortschritt bleibt sichtbar abgewiesen,
- tatsächliche XP statt Levelminimum, gleiche aufgerundete Awardverteilung,
  unveränderte Datenbytes vor/nach Vorschau und identische Werte nach Fresh,
- fehlende XP und unbekannte Rasten mit eigenem unabhängigen Budget,
- numerische Grenzen und zusammengefasste große Tagesmengen,
- beide leeren XP-Felder mit ausdrücklicher Korrektur auf gültige Null,
- echte Aufteilung auf zwei Scenes, Fokuswechsel und Party-Deaktivierung,
- eigene Zeilen/Moduswechsel ohne Partywrite und ältere Antwort nach Reaktivierung.

Mit den eingegangenen Chase-Draft-/Wechselprüfungen bestanden 41 lokale Fälle
und der Desktop-Typecheck. Linkedom belegt kontrollierte Handler-/Readwirkungen;
native Popover-, IPC-, Tastatur-, Monitor-, Last- und Produktabnahmen bleiben offen.

## Nächste ausführbare Schritte

1. **Partyprojektion und aktuelle Faktengrundlage schließen.** Die aktuelle
   DayView besitzt noch keine explizite Roster-/Fortschrittsrevision pro Ergebnis.
   `adventuring-day-contracts.ts` und Reader um die tatsächlich konsumierte
   Mitgliedschafts-/Progressbasis ergänzen, wenn weitere Verbraucher sie nutzen.
   Profillabel und XP-/Rastbasis atomar halten. Alte Vorschauen dürfen nie als
   Schreibgrundlage dienen. Abnahme: XP-Korrektur, Mitgliedschaftsänderung,
   unbekannte Basis und Refresh im selben Workspace; keine Sceneänderung.
2. **Verbleibende Rast-/Awardübergänge prüfen.** Feste Dayvorschau-Startbudgets
   gegen die Originalrechnung und `restFrame` nach Leveländerung prüfen;
   theoretische Etappen bleiben von bestätigten Rasten getrennt. In
   `storage/progression.ts`/`progression-ui.ts` gültige XP-Herkunftstypen und
   prüfbare Referenzen einschließlich Storyawards konsistent schließen; der
   aktuelle Referenzguard prüft nur Campaign-/Characterzuordnung. Defekte
   Quellfacts, Health-/Lootfremdreferenzen und ältere Verlaufseiten prüfen.
   Getrennte Rundung bei Dayforecast, Completion und Partyaward mit gemischten
   aktiven/Reserve-/Load-only-/XP-only-Empfängern vergleichen. Zeitgebundene
   ausgewählte Rasten am realen Clock-/Autonomieanschluss abnehmen; spätere
   XP-/Loot-Ereignisse dürfen die ursprünglichen Rast-/Awardfacts nicht ändern.
3. **Oberfläche am Host abnehmen.** Popoveröffnung/-schließen, Fokus zurück zum
   Trigger, Escape, Tastatur, 200 %, Scrollen vieler Zeilen, lange Namen,
   Storage-/IPCfehler und tatsächliche numerische Browserfelder prüfen. Für
   fehlerhafte erforderliche aktive Records eine hilfreiche Ownernavigation
   bereitstellen. Öffnen/Refresh muss alte Summen sichtbar als ausstehend zeigen.
4. **Kosten nach realem Bedarf messen.** Die aktive Query ist enger, aber liest
   weiterhin jede aktive Figur. Große Party-/Rosterbestände und häufige
   Fortschrittsänderungen messen; danach eine gemeinsame begrenzte Partyprojektion
   verwenden, falls die Messung es erfordert. Kein separater persistierter
   Rechenergebniszustand und kein paralleles XP-/Rastmodell; der lokale
   Eingabeentwurf bleibt davon getrennt.


## Geplante Rasten zwischen Begegnungen (0.135)

Der lokale Encounter-Tagesplan erlaubt vor jeder Zeile „Ohne Rast“, „Kurze
Rast“ oder „Lange Rast“. Reihenfolge und Wiederholungen bleiben editierbar;
beim Aktualisieren der Vorlagen bleiben die gesetzten Rasten erhalten.
Eine Pause gilt für alle Rechnerfiguren und vor der gesamten Zeile. Für Pausen
zwischen Wiederholungen wird dieselbe Vorlage mehrfach eingefügt.

Der Party-Reader simuliert die Etappen auf isolierten Fortschrittskopien.
`restAfter` ist dieselbe Partyregel für bestätigte Rasten und Vorschau:
kurze Rast setzt Shortverbrauch zurück und teilt den verbleibenden Rahmen;
lange Rast setzt Tagesverbrauch und Abschnitte zurück. Eine kurze Rast heilt
kein überschrittenes Tagesbudget und keinen unbekannten Raststand. Eine
geplante lange Rast schafft nur einen hypothetischen bekannten Rahmen, während
Snapshot und Topbar weiterhin die bestätigte unbekannte Basis zeigen.
Die Einzelansicht zeigt auch diesen Übergang von offen zu hypothetisch bekannt.

Belastung und Verdienst werden weiterhin pro Begegnung gerundet und unabhängig
von den Pausen aufsummiert. Startlevel bleiben fest; Verdienst-Levelwechsel
ändern die Rastprognose nicht. Eigene Levelgruppen starten nach einer langen
Rast. Das allgemeine XP→Tage-Modell mit zwei kurzen Rasten pro Tag bleibt als
separates theoretisches Modell ausgewiesen. Keine Zeit, HP, XP, bestätigten
Rasten oder Journalereignisse werden geschrieben; kein neues Speicherschema.

Grenzen: Pausen gelten derzeit für die gesamte Rechnerparty; Dauer,
Teilnehmerauswahl, Reisekosten und Übernahme in einen dauerhaft gespeicherten
Sessionablauf sind nicht Bestandteil dieses lokalen Rechners.


## Levelmarken und Zielverdienst (0.144)

Im bestehenden Day-Popover zeigt „Levelentwicklung planen“ die nächsten
Levelmarken jeder Rechnerfigur. Die aktive Party nutzt ihre bestätigten XP,
eigene Levelgruppen starten am Levelminimum. Figuren aus anderen aktiven
Scenes bleiben einbezogen; Figuren auf Level 20 werden ausdrücklich gezählt.
Die Partyprojektion liefert den kleinsten Gruppenverdienst, der nach der
bestehenden Aufrundung der XP-Anteile die jeweilige Marke erreicht.

„Verdienst bis Level … einsetzen“ schaltet auf die Fortschrittsvorschau und
übernimmt ausschließlich diesen Gruppenverdienst als getrennte lokale
Planungseingabe. Belastung, Levelgruppen und gespeicherte Party bleiben erhalten.
Die Fortschrittsansicht listet alle erreichten Levelmarken mit dem jeweiligen
Gruppenverdienst, persönlichen Anteil und den betroffenen Figuren. Lange Listen
lassen sich in Schritten von 20 vollständig nachladen.

Bei eingeschaltetem Encounter-Tagesplan bleiben dessen XP maßgeblich; die
Zielknöpfe sind deaktiviert. Erreichte Levelmarken nennen die erste abgeschlossene
Planzeile, nach der sie erreicht sind. Wiederholungen innerhalb einer Planzeile
werden nicht einzeln aufgeschlüsselt. Veraltete Ergebnisaktionen werden bei
Eingabeänderung, Workspacewechsel oder Schließen verworfen.

Keine XP-, Rast-, Zeit- oder Rosterbuchung; kein neues Speicherschema.
Hypothetische Levelwechsel verändern weiterhin nicht die festen Startbudgets
der Tages- und Rastvorschau. Hostprüfung umfasst Zielübernahme, eigene Gruppen,
mehrere Levelwechsel, Encounterplan, Escape/Fokusrückkehr und Neustart mit
unveränderten Partyfacts. Breite Plattform-, Zoom- und Großpartyabnahme bleibt offen.

## Rastmarken innerhalb wiederholter Begegnungen (0.151)

Die Topbarplanung zeigt bei einer Wiederholungszeile jetzt, nach welcher einzelnen
Begegnung bekannte Figuren ihre nächste kurze oder lange Rast erreichen. Bereits
vor der Zeile fällige Rasten erscheinen bei null Begegnungen. `projectDayRestStops`
nutzt dasselbe `restFrame` wie Party und laufende Vorschau; frühe kurze Rasten,
übrig gebliebene Abschnitte, überzogene Budgets und unbekannte Raststände behalten
ihre Bedeutung. Die aufgerundete Belastung je Begegnung bleibt maßgeblich.
Zählereignisse statt einer Matrix aus Figuren und Wiederholungen halten die
Berechnung auf Partygröße plus tatsächlich angezeigte Marken begrenzt.

„Hier kurze/lange Rast einplanen“ teilt eine Zeile an der gewählten Marke und setzt
die Rast vor den verbleibenden Teil. Zum Beispiel werden zwölf Begegnungen zu
„3 Begegnungen, kurze Rast, 9 Begegnungen“. Der vorherige Rastbeginn bleibt am
ersten Teil; Quellen-ID und Revision, gesamte Gegnerzahl, Belastung und Verdienst
bleiben erhalten. Ab einer bereits fälligen Marke wird die Rast vor die vorhandene
Zeile gesetzt. Bei 20 Zeilen bleibt die Teilung gesperrt und erklärt die Grenze.
Alte Ergebnisaktionen verlieren bei Eingaben, neuem Read, Schließen und
Kampagnenwechsel ihre Wirkung. Der bestehende lokale Kampagnenentwurf speichert
die entstandenen Zeilen/Rasten; es gibt kein neues Speicherschema und keine
Party-, Zeit-, XP-, Encounter- oder Rastbuchung.

Die Marken liegen nach vollständigen Begegnungen: eine Belastungsmarke kann im
Kampf überschritten werden. Die Planung behauptet daher keine sichere Pause
innerhalb eines Kampfs. Unbekannte Figuren erhalten keine erfundene Marke;
eine geplante lange Rast kann wie bisher einen hypothetischen bekannten Zustand
schaffen. Pausen gelten weiterhin für alle Rechnerfiguren. Am Ende der letzten
Zeile ist keine weitere Begegnung aufzuteilen. Teilnehmerrasten, Dauer und
Übernahme in einen gespeicherten Sessionablauf bleiben offen.


## Vollständige Figurenansicht im Rechner (18.10.2026)

Die aktuellen Figurenfacts und die XP-/Levelvorschau zeigen zunächst höchstens
40 Figuren. „Weitere Figuren“ erweitert dieselbe bestätigte Tabelle in Schritten
von 40; ein Zähler nennt die sichtbare und gesamte Anzahl. Bisher waren weitere
aktuelle Facts nur als ausgelassen gemeldet und weitere XP-Projektionen still
abgeschnitten. Summen und Berechnung verwenden weiterhin die gesamte Party.

`adventuring-day-ui.ts` paginiert ausschließlich die bereits empfangenen Werte.
Keine neue IPC, keine zusätzlichen Reads, keine Datenmigration oder Partywrites.
Die Ergebnisgeneration, der Workspace-Token, der offene Popover und die Verbindung
zum aktuellen Dokument entziehen alten Seitenaktionen ihre Wirkung, sobald neue
Eingaben oder ein neuer Kontext die Antwort ablösen. Nach bestätigtem Refresh
beginnt die neue Tabelle wieder mit den ersten 40 Figuren.

Gezielter Store-/DOMgegenbeleg: 45 aktive Figuren, letzte Figur mit 299 XP;
aufgerundeter Gruppenverdienst von 1 XP erreicht auch bei ihr 300 XP / Level 2.
Beide Tabellen müssen diese Figur erreichbar machen. Seitenaktionen dürfen bei
laufender Neuberechnung keine alten Werte ergänzen oder neue Reads starten;
Roster-, Fortschritts- und Scenefacts bleiben unverändert. Native Probe:
`python3 tools/ui-session.py node tools/test-desktop-day-party.mjs`, bei 100 und
200 Prozent einschließlich erneutem Öffnen und normalem Prozessende. Dieser
begrenzte Ablauf ersetzt keine vollständige Party-/Produktabnahme.
