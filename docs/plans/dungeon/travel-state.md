# Dungeonreise: bestätigter Laufstand und nächste Schritte

Quelle: [Dungeon Travel State](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-travel-state.md)
und angrenzender [Reisevertrag](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/dungeon/requirements/requirements-dungeon-travel.md).
Maßgeblich ist ein dauerhaft nutzbarer GM-Steuerungsbereich unabhängig von der
Kartenpräsentation; die konkrete Tab-/Dialogform ist austauschbar.

## Vorhandener Laufstand

`dungeon-play.ts`/`dungeon-contracts.ts` führen Vorschau und bestätigte Route,
Abschnittszeiten, nächste Position, Scene-/Gruppen-/Positionsrevisionen und
Geometriebasis. Jeder bestätigte Abschnitt bucht Weltzeit und Position in der
vorhandenen Transaktion; `dungeon_receipt` verhindert doppelte Buchung.
Unterbrechungen durch Wahrnehmung, Inhalte, Trigger oder Verfolgung bleiben
GM-Entscheidungen. `dungeon-ui.ts` zeigt Status, Steuerung und manuellen Zeitansatz.

Freie GM-Platzierung merkt sichtbare Geometrie und öffentliche Inhalte, bucht
keine Reisezeit und öffnet keine Encounter-/Suchhinweise. Bestätigte Bewegung
prüft diese Hinweise weiterhin und hält zur GM-Klärung an. Bereits offene
Hinweise bleiben bei einer freien Platzierung erhalten.

Beim unabhängigen Kampagnentransfer binden `campaign-data.ts` und
`dungeonGeometryBasis` ausschließlich zuvor aktuelle Geometriebasen an die neuen
lokalen Kennungen. Dasselbe gilt für die ursprüngliche Spurbasis einer Verfolgung.
Schon vor dem Export veraltete Basen werden nicht freigegeben. Position,
Gruppenrevision, Uhr, Reststrecke und bereits bestätigte Entscheidungen werden
nicht neu berechnet. Quellkampagne und Paketbytes bleiben unverändert.
Bereits früher importierte Kopien mit unpassenden Basen benötigen weiterhin
explizite neue Routen-/Spurprüfung; keine heuristische Rückreparatur.

`desktop-dungeon-travel-copy.test.mjs` verwendet einen wirklichen U-förmigen
Volumengang und eine Gruppe: Teilstrecke → Pause → Fresh → unabhängige Kopie →
Fresh → Fortsetzen. Es prüft Abschnitt/Restzeit, Receiptreplay, Quellenprosa und
unveränderte Quell-/Paketbytes sowie getrennte echte Stil-, reine Volume-
Bodenflächen- und Spuränderungen. Volumeänderungen invalidieren die Route auch
bei unveränderter Raumkontur: der vorhandene Drawingwriter erhöht die
Roomrevision mit.
Das ist ein Storebeleg, keine native Gesamtqualifikation.

## Ausführbare weitere Lieferung

1. **Gruppentempo geliefert, Sonderbewegung weiter ausbauen.** Der Reisebereich
   zeigt die aktuelle Szenengruppe, langsamste einbezogene Figur, Profilbewegung,
   Einzelvorgaben, ausgenommene Mitglieder und ausdrückliche Gruppenvorgabe.
   Die Vorgaben leben in `dungeon_travel_settings`, nicht in Charakterprofilen
   oder Dungeon-Geometrie. Revision und Mitgliedschaft schützen Übernahme und
   Vorschau. Änderungen gelten für neue Vorschauen; angenommene Routen behalten
   ihre geplanten Sekunden. Fehlende oder Nullraten werden nicht zu einem
   erfundenen Tempo; explizite Transportentscheidung/Override bleibt beim GM.
   Besondere Flug-, Kletter- und Schwimmprofile der Figuren sind weiterhin offen;
   dafür gibt der GM ein effektives Tempo vor. Explizite Path-Zeitfaktoren und
   Gesamtdauer bleiben zusätzliche sichtbare GM-Vorgaben.
2. **Explorationsrunden.** 1/5/10/15/30 Minuten und eigene Dauer als sichtbaren
   Laufstand liefern; gegenwärtiges `maxSteps` begrenzt Wegpunkte, keine Runden.
   `executeDungeon(step)` muss Abschnitt/Restdauer und die bestehenden Scenezeit-/
   Autonomy-Entscheidungsgrenzen gemeinsam behandeln. Keine Zeitkategorien für
   freie Tischhandlungen. Abnahme: Teilabschnitt, GM-Pause, geänderter Roundwert,
   Trigger/Catch-up, Retry und Neustart ohne Doppelzeit oder übersprungene Grenze.
3. **Gemeinsamer Steuerungskontext.** Positions-/Heading-/Raumtexte, Ziel, aktive
   Checks, Spuren/Verfolgung und NPC-Pendinggrenzen im vorhandenen Reisebereich
   erreichbar halten. Gruppenbildung/-teilung bleibt beim Live-/Rosterowner,
   NPC-Jobs bei Autonomy. Karten-/Ansichtswechsel darf keinen zweiten Reisestand
   erzeugen.
4. **Zusammenhängend qualifizieren.** Native Ansichtwechsel, lange Texte, 200 %,
   langsame Reads und tatsächliche Prozessunterbrechung mit Reise, Trigger,
   Wahrnehmung, Verfolgung und NPCs prüfen. Weitere räumliche Owner gegen den Geometrieguard
   prüfen; der gezielte Volume-/Stilbeleg qualifiziert nicht sämtliche
   räumlichen Änderungsarten oder ihre native Bedienung.


## Bewegungsprofil und Laufzustand (0.137)

`dnd5e-2014-dungeon-pace-v1` rechnet normale lokale Bewegung aus der
Profilbewegung: ft pro Sechssekundenbewegung × 10 × 0,3048 m. Kriechen, Klettern
und Schwimmen ohne besondere Rate verwenden halbes Tempo. Flug wird aus dem
Gehprofil nicht abgeleitet. Die
[Basic Rules 2014: Combat](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat)
geben die Sechssekundenrunde und Bewegung an;
[Adventuring](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/adventuring)
beschreibt die zusätzlichen Bewegungskosten. Die lineare Hochrechnung ist der
benannte lokale Rechenansatz; kein Dash, kein Fernreise-/Tagesmodell und keine
automatische Tragfähigkeits- oder Erfolgsentscheidung. Einzel-/Gruppenvorgaben
sind bereits effektive m/min, auf die dieser Modusabschlag nicht erneut wirkt.
Autorenfaktoren von Paths und der sichtbare zusätzliche Zeitfaktor bleiben
separate, ausdrücklich gesetzte Einflüsse.

Ausgenommene Figuren bleiben im Gruppentoken und erreichen das Ziel zusammen.
Die Oberfläche blockiert neue Vorschauen bei offenen Tempofeldern. Verwerfen
lädt die bestätigten Werte; spätere Reads behalten offene Eingaben, spätere
Bestätigungen behalten inzwischen weitergeänderte Felder. Gegenläufige
Mitgliedschafts- oder Einstellungsänderungen brauchen eine neue Übernahme.
Die unabhängige Kampagnenkopie remappt Szenen, Figuren und begrenzende Mitglieder
auch in eingefrorenen Routenvorschauen. Diese Laufdaten sind keine authored Dungeonwahrheit; ein authored Dungeonpaket
darf sie nicht enthalten.
