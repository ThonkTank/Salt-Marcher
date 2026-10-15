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

1. **Wirksames Gruppentempo.** In `dungeon-ui.ts`, `DungeonRequest` und dem
   bestehenden Laufstand das tatsächliche Tempo erklären: langsamstes einbezogenes
   Mitglied, explizite Gruppenvorgabe, ausgeschlossene/getragene Mitglieder und
   einzelne Vorgaben. Aktuell ist das Feld ein manuell bestätigter Wert (18 m/min
   als Eingabevorgabe), keine automatische Langsamstenberechnung. Regeln aus dem
   versionierten Bewegungsprofil herleiten, keine ungeprüfte Umrechnung von
   `speedFeet` erfinden. Änderungen gelten sichtbar für nächste Vorschauen;
   bestätigte Zeit nie rückwirkend umdeuten. Abnahme: unterschiedlich schnelle
   Figuren, Ausschluss, Override löschen, Gruppenwechsel und Fresh.
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
