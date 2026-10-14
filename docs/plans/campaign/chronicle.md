# Erklärbare Kampagnenhistorie und Chronik

Stand: 13.10.2026. Verbindlicher Gesamtumfang: [SCOPE](../../SCOPE.md),
[Campaign/Data](../../../ROADMAP-SALTMARCHER-SMR-01-CAMPAIGN-DATA-PLAN.md)
und [Gesamtportfolio](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md).
Die Chronikanzeige ist ein Zugang zur Historie; sie ersetzt deren Fachvertrag nicht.

## Quelle und Ziel

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, Abschnitte
„Corrections And History“ (L530–535) und „Explanatory Campaign History“
(L887–904), verlangen bestätigte Zeit-, Reise-, Encounter-, XP-, Party-, NPC-,
Stock- und Korrekturfolgen. Eine Korrektur hängt einen verknüpften Eintrag an;
frühere Fakten bleiben erhalten. Rückdatierte Weltzeit und späterer Zeitpunkt
am Spieltisch sind getrennt. Reise-Undo und ausdrückliche Löschung besitzen
enge eigene Regeln. Das Quellenregister bindet die Datei an SHA256
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`;
der lokale Quellenstand wurde damit verglichen.

## Aktueller Anschluss und Korrektur

`src/app/storage/chronicle.ts` kombiniert bestätigte `progress_event`-,
`world_history`- und `scene_time_step`-Records in einer Lesetransaktion. `chronicle-contracts.ts`,
Main/preload und `chronicle-ui.ts` bieten Kategorien, Textfilter und Markdown.
Der aktuelle Ausschnitt liest relevante Records in Portionen von höchstens
2001 unter demselben Snapshot. Kategorie und Text werden vor der Ergebnisgrenze
angewendet; eine Suche erreicht damit auch ältere Portionen. Die Ausgabe zeigt
höchstens 2000 passende, zusammengefasste Einträge. Das ist keine vollständige
Historiennavigation oder vollständige Exportqualifikation.

Drei Gegenproben fanden zwei zusammenhängende Fehler: 2500 interne Statusrecords
verdrängten einen älteren sichtbaren XP-Eintrag aus dem Rohfenster; 2002
zusammengefasste Awardrecords meldeten den verbliebenen Eintrag als vollständig;
ein gekürzter Markdownexport trug keinen Hinweis. Der Reader filtert jetzt die
von `progressEntry` dargestellten Eventarten vor dem SQL-Limit. Die Lookahead-Grenze betrifft nun passende Einträge, nicht einzelne
Beteiligtenbelege. Ein vollständig gelesenes Award mit mehr als 2000 Belegen
ist deshalb vollständig; mehr als 2000 passende Ereignisse bleiben als
`truncated` markiert. Markdown übernimmt diesen Hinweis auch bei leerem Suchergebnis.
Datenquellen und ihre Textinhalte werden dabei nicht verändert. Integrierte
Kontextlabels werden ebenfalls gegen ihren Bytehash geprüft. Die begrenzten
Quellen werden nacheinander gestreamt; ein noch unbenutzter SQLiteiterator darf
bei einem Quellfehler den Transaktionsrollback nicht mit einer Busy-Meldung
verdecken. Die vorhandene Fehlergegenprobe prüft diese Grenze.

`tests/desktop-chronicle-window.test.mjs` bewahrt die SQLite-Gegenproben für
interne Records, 2000/2001-Grenze, Quellenüberlauf, gemeinsame Ausgabegrenze
und beschädigte Quellen einschließlich Rollback. Vollständig gruppierte Awards
werden vollständig gelesen und lösen ohne ausgelassene Ereignisse keinen
Kürzungshinweis aus. Zusammen mit den neuen Filter-, Gruppen-, UI-, Chase-,
Szenentisch- und Todesrettungswurfprüfungen bestanden zuletzt 37 gezielte Tests.
[Nativer Nachweis](../../reference/gm-ux-qa/2026-10-13-chronicle-search.md):
älterer Treffer hinter 2000 neueren Ereignissen, gefilterte Markdownausgabe,
Fresh und kontrollierter IPC-Lesefehler. Kein Hard-Crash-, umfassender
Dateidialog- oder vollständiger Produktnachweis.

Historische `narrative-state`-Records ohne einen tatsächlich erfassten
`after.status` bleiben interne Statusbelege und verbrauchen kein sichtbares
Ergebnisfenster. Bestätigte offene/geschlossene Statusänderungen bleiben auch
ohne den erst später eingeführten Award-/Auftragstitel sichtbar. Ein ausdrücklich
ungültiger Status ist ein Quellfehler, kein Anlass zum stillen Auslassen. Die
Windowproben unterscheiden diese Fälle und erhalten die ursprünglichen Records.

## Manuelle Momente am Spieltisch

`LiveAction.live-moment` schreibt ausdrücklich bestätigte Notizen als
`world_history` mit Bereich, Ursprungsscene, damaligen Figuren, Ort und Weltzeit.
Der Chronikreader behält die vorhandenen Besuchsergebnisse, Quellenprüfungen
und Filter vor dem Ergebnislimit bei. Ein Moment bestätigt weder Kampfabschluss
noch XP oder Loot; diese Fakten bleiben bei ihren bestehenden Writern.

Der Renderer bindet Scene und Fokus bereits beim Submit und kopiert Titel,
Notiz und Bereich vor dem Flush. Geänderter Fokus vor dem Senden verhindert
diesen Submit. Ein bereits bestätigter älterer Moment bleibt in der Historie;
seine spätere Antwort ersetzt keine neuere fokussierte Scene und leert keine
weiter eingegebene Notiz. Nur eine unveränderte Formfassung wird nach Erfolg
geleert. Drei kontrollierte DOM-/SQLiteproben in
`desktop-live-moment-context.test.mjs` prüfen ursprünglichen Wortlaut samt CRLF,
Fokuswechsel während Flush und spätere Antwort mit weiter nutzbarer neuer Scene.

Die Momentfelder liegen jetzt in einem temporären Rendererbestand je Scene;
Fokuswechsel erhält die jeweilige Eingabe, Campaignwechsel setzt den Bestand
zurück. Ein bestätigter Moment entfernt nur die tatsächlich gesendete Fassung
aus diesem Bestand; spätere Texte bleiben erhalten. Auch eine verspätete
Scene-Content-Antwort darf die neuere Fokusprojektion nicht ersetzen. Das
ist noch keine persistierte Wiederaufnahme. Nächster Anschluss: Rohfelder
an Campaign und Ursprungsscene binden, vor Contextwechsel/Fresh sichern und
nach einem nicht eindeutig bestätigten Command dessen Status prüfen. Einen
unbekannten Ausgang nicht durch erneutes Festhalten verdoppeln. Native IME,
Fokus-/Tastaturbedienung und wiederaufgenommene unvollständige Notizen bleiben
separat abzunehmen; lokale Storebelege schließen diese Schritte nicht.

## Party- und Zeitanschluss vom 14.10.2026

Der Livewriter protokolliert Aktivierung, Deaktivierung und Scenemove mit
Character-/Scene-IDs sowie bestätigte Zeit mit eigener Erfassungszeit. Die
Chronik unterscheidet Party- und Reisefakten und zeigt bestätigte Zeit ohne
zusätzliche Kopie derselben Reisefolge. Alle drei Quellen wenden Kategorie und
Text vor ihrem passenden Ergebnislimit an; vollständige Combat-Awardgruppen
bleiben erhalten. Fünf Coreprüfungen und 13 Store-/DOM-Prüfungen qualifizieren
diesen integrierten Reader lokal.

Eine SQLite-Gegenprobe fand alte `fromSceneId`-/`toSceneId`-Verweise in der
unabhängigen Kampagnenkopie. `campaign-data.ts` remappt jetzt beide strukturellen
Slots zusammen mit den Character-IDs. Move- und Deaktivierungshistorie zeigen
kopierte Scenes; authored Scenetitel und Quellpaketbytes bleiben identisch.
Kopie und anschließender Backup sind lokal geprüft. Historische Linkkorrekturen,
vollständige Navigation und native Abnahme bleiben offen.

## Nächste ausführbare Lieferung

1. **Alle bestätigten Fachfolgen erschließen.** Quellenmatrix an den tatsächlichen
   Commands in `storage/live.ts`, `world.ts`, `progression.ts`, Shop- und
   Autonomieports erstellen. Fehlende Party-/Zeit-/Stock-/NPCfolgen aus dem
   jeweiligen autoritativen Commit publizieren; Fachwirkung, History und Receipt
   bleiben atomar. Bereits gespeicherte Events lesen, keine zweite allgemeine
   Eventarchitektur beginnen. Abnahme: je ein bestätigter Nutzerweg mit Fresh,
   Receiptreplay und kontrolliertem Rollback; keine doppelten Historieneinträge.
2. **Verknüpfte Korrekturen und Zeit zeigen.** `ChronicleEntry` braucht Quell-/
   Korrekturverweise sowie vorhandene Scene-/Weltzeit; `recordedAt` bleibt der
   Zeitpunkt am Spieltisch. Reader und UI unterscheiden ursprünglichen Fakt,
   Korrektur und aktuelle Wahrheit. Bestehende `correctionOf`-Verträge konsumieren.
   Abnahme: HP-/XP-/Lootkorrektur und rückdatierte Weltfolge behalten ihre
   ursprünglichen Records; kausales Reise-Undo entfernt nur erlaubte Folgen.
3. **Begrenzte Navigation und vollständige Ausgabe schließen.** Serverseitige Kategorie-/Textfilter sind angeschlossen. API, Reader und
   UI zusätzlich auf öffentliche stabile Cursor umstellen,
   beide Quellen deterministisch zusammenführen und nur die benötigten Namen/
   Orte/Kämpfe lesen. Momentan laden diese Kontextmaps ganze Kampagnentabellen;
   ein Quellenlimit allein begrenzt diesen Aufwand nicht. Gruppierte Kampfawards
   dürfen an einer Seitengrenze keine Beteiligten verlieren. Ein vollständiger
   Export läuft unter einem festgelegten Snapshot in begrenzten Portionen mit
   Abbruch/Fortschritt; bis dahin bleibt der Ausschnitt ausdrücklich markiert.
   Abnahme: mehr als 2000 Fakten, viele interne Records, zwei Quellen, verschiedene
   Suchfilter und ein über die Grenze reichender Kampf liefern weder Lücken noch
   Duplikate; ein älterer Suchtreffer bleibt erreichbar.
4. **Daten- und Bedienabschluss.** Kampagnenkopie remappt strukturelle Quell-/
   Korrekturverweise, bewahrt Prosa und schützt den originalen Snapshot. Erasure
   entfernt eigene Fakten und verdeckte Rekonstruktionen; Konflikte nach erlaubter
   Ziellöschung bleiben erkennbar. Archivierte Eigentümer sind historische
   Referenzen. Abschließend tatsächliche Desktopprobe mit Kampagnenwechsel,
   Fresh, Tastatur, Skalierung und Markdownausgabe; lokale Tests ersetzen sie nicht.
