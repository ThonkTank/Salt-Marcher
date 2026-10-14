# Adventuring Day: Partyvorschau und bestätigte Rastfakten

Stand: 14.10.2026. Ergänzt den [Party-/Scenevertrag](smr03-live-scene-contract.md#party--roster--und-adventuring-day-projektion)
und den [Gesamtumfang](../../SCOPE.md). Der Rechner ist ein Party-/Live-Werkzeug;
der Atlas ist weder sein Owner noch eine Voraussetzung.

## Fachquelle und vorhandener Nutzerweg

Die gebundenen SaltMarcher-Quellen `requirements-adventuring-day-dropdown.md`
und `requirements-adventuring-day-calculator.md`, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, verlangen einen eigenen Topbartrigger,
aktuelle Partyzeilen, lokale eigene Zeilen sowie Budget- und XP→Tage-Modus.
Öffnen aktualisiert die Partybasis. Zeilenbearbeitung verändert weder Roster
noch Scenezuordnung. Die Inhaltsprüfung bestätigt die Registerhashes
`b5a97494844645ee7e94999201e6e90c14f20c0640379d6de8af210bf0969a11`
(Dropdown) und `ae57654b09149229410eff31e49545d1b0f71316c61c8f267c55f812342edc12`
(Rechner). Die zwei Oberflächenanforderungen allein qualifizieren noch keine
vollständige XP-/Rastregel.

`adventuring-day-ui.ts` führt Topbar, Popover, Quelle, Zeilen, XP-Eingaben und
Antwortgeneration. `CampaignStore.adventuringDay` liest in einer gemeinsamen
SQLite-Transaktion; `storage/adventuring-day.ts` komponiert die aktive Party.
`adventuring-day-model.ts` verwendet die gemeinsamen `dailyXp`, `levelXp`,
`xpLevel`, `xpShare` und Encounterthresholds. Bestätigte XP-/Raständerungen bleiben
bei `executeProgress`; die Vorschau erzeugt keine Writes oder Receipts.

Die aktuelle Rechnung verwendet feste Startlevelbudgets, zwei Drittelmarken
für kurze und eine Tagesmarke für lange Rasten. Verbrauchs-XP und optionale
Verdienst-XP sind getrennt; `xpShare` rundet je Empfänger auf. Aktive Figuren
beginnen die Levelvorschau mit ihren tatsächlichen bestätigten XP, eigene
Levelzeilen mit dem jeweiligen Levelminimum. Die Etappenanzeige begrenzt volle
Einzeltage auf 30 und fasst weitere Tage zusammen, ohne ihre Summe abzuschneiden.
Das sind vorhandene Rechenregeln, keine neu bestätigten Rasten oder XP-Awards.

## Geprüfte Daten- und Eingabegrenzen

Der erste Reader verwendete `readProgress` für den gesamten Roster einschließlich
Kampfmasken und inaktiver Figuren. Eine beschädigte inaktive Fortschrittszeile
blockierte deshalb sowohl die gesunde aktive Party als auch eigene Rechnerzeilen.
Der Rechner konsumiert jetzt nur `active=1` in stabiler Rosterreihenfolge,
`readProgressCharacter` und `readCharacter` der betreffenden Figuren. Er liest
keine Kampfmasken oder Fortschrittsnotices. Beschädigte benötigte aktive
Fortschritts-/Profilrecords bleiben Fehler; die Einschränkung versteckt sie nicht.
Globale Backupprüfung und andere Fortschrittsverbraucher werden nicht gelockert.

Die aktive Party umfasst alle Split Scenes. Fokus, Sceneort und Uhr liefern
keine alternative Auswahl. Fehlende XP bleiben `null`; daraus wird weder Level 1
noch ein Budget erfunden. Ein unbekannter Raststand sperrt den bestätigten
Verbrauchsindikator, aber kein unabhängig aus bekannten Levels berechenbares
Tagesbudget. Eigene Levelzeilen bleiben auch bei unbekannten aktiven Levels
benutzbar. Leere Gesamt-/Verdienst-XP werden als ungültige numerische Eingabe
weitergereicht und durch denselben Partyrechner erklärt; `Number('')` darf sie
nicht zu einem gültigen Nullergebnis machen. Ausdrückliche Eingabe `0` ist gültig.

Eigene Zeilen und Rohwerte bleiben während dieses Rechnerkontexts transient.
Schließen/Öffnen bewahrt sie; Kampagnenreaktivierung setzt den Kontext zurück.
Antwortgeneration und Workspace-Token verhindern, dass ältere Reads nach
Reaktivierung eine neuere Partybasis überschreiben. Diese Vorschau erteilt
keine Autorität für einen späteren XP-/Rastcommand.

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

Fünf Fälle in `tests/desktop-xp-rest-corrections.test.mjs` prüfen den echten Store:
Abwärtskorrektur über Levelgrenzen bis null, erhaltene frühe/zweite/zusätzliche
Shortsections und Longreset, Vorschau/Writer-Gleichheit, unveränderte verlinkte
Herkunft, Replay ohne zweite Wirkung und Fresh. Belastung ohne bekannte XP und
Rollback der ersten Teilnehmerwirkung bei einem späteren stale Empfänger sind
getrennte Gegenproben. Eine tatsächliche Party-DOMvorschau zeigt den Abzug und
erklärt erhaltenen Verbrauch. Diese kontrollierten Fälle ersetzen keine native
XP-/Rast-/Abrechnungsabnahme.

## Lokale Belege und Grenzen

Neun Fälle in `tests/desktop-day-calculator.test.mjs` verwenden den echten Store,
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
   Rechnerzustand und kein paralleles XP-/Rastmodell.
