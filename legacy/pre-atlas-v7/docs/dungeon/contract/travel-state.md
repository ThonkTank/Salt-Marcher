# Dungeonreise: bestätigter Laufstand und nächste Schritte

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: dungeon
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

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
GM-Entscheidungen. Eine neue Berechnung verwirft die vorherige Vorschau und
aktualisiert sofort auch die Startfreigabe im gemeinsamen Atlas. Die UI
übernimmt nur Antworten zur angefragten Gruppe, Zielposition, Bewegung und
Zeitvorgabe; ausschließlich das automatische Gruppentempo darf der Provider
auflösen. Lokale Zieländerungen verwerfen weiter verspätete Antworten. Eine
abgewiesene Auswertung startet keine Reise; erneutes Vorbereiten bleibt möglich.
`dungeon-ui.ts` zeigt Status, Steuerung und manuellen Zeitansatz.

Freie GM-Platzierung merkt sichtbare Geometrie und öffentliche Inhalte, bucht
keine Reisezeit und öffnet keine Encounter-/Suchhinweise. Bestätigte Bewegung
prüft diese Hinweise weiterhin und hält zur GM-Klärung an. Bereits offene
Hinweise bleiben bei einer freien Platzierung erhalten.

Passagenlinks prüfen neben Scope und Entfernung auch den Raum und das Geschoss
der Gruppe gegen den Quellanker. Überlagerte Rasterkoordinaten eines anderen
Geschosses erlauben keinen Durchgang. Fehlende Orts-/Passagenziele und ungebundene
Zielpassagen bleiben mit lokaler Beschreibung sichtbar, sind aber keine aktivierten
Reiseaktionen. Die Oberfläche verwendet den vorhandenen `passageStatuses`-Read;
der Writer prüft das Ziel erneut und verwirft einen ungültigen Befehl atomar.
`desktop-dungeon-passage.test.mjs` prüft diese Grenzen sowie gültige Landung,
konfigurierte Zusatzzeit, Receiptwiederholung und Fresh. Gewöhnliche Durchgangszeit
zusätzlich zur Autoren-Zusatzzeit und Heading bei verlinkter Landung bleiben
separat aus dem vollständigen Reisevertrag zu liefern; der Linktest bestätigt sie
nicht.

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
2. **Explorationsrunden geliefert (0.150).** Die vorhandenen revisionierten
   Reisevorgaben speichern optional `explorationRoundSeconds`; ohne Eintrag sind
   sichtbar10Minuten wirksam.1/5/10/15/30Minuten und eigene positive ganze Sekunden
   sind wählbar. Einstellungen bleiben Laufstand der Scene, keine Dungeonwahrheit.
   `round` benutzt aktuelle Einstellungsrevision und Fokus sowie die bisherigen
   Positions-/Clock-/Membership-/Geometrieguards. Ein Aufruf bucht höchstens die
   Rundendauer, endet aber bei Ankunft oder einem GM-Hinweis früher. Es wird keine
   freie Tischhandlung klassifiziert oder automatisch bepreist.

   Lange Rasterabschnitte speichern `segmentElapsedSeconds` am bestehenden
   Journey. Der Marker bleibt bis zum Erreichen der nächsten Zelle am letzten
   bestätigten Rasterpunkt; die UI benennt den Zwischenfortschritt. Zeit läuft
   über den vorhandenen Scenecommand einschließlich seiner Worldfolgen. Ein
   späterer Runden- oder Rasterpunktschritt bucht ausschließlich Restsekunden.
   Teilfortschritt bleibt bei Pause, Restart und unabhängiger Campaignkopie
   erhalten. Neue Rundendauer verändert keine eingefrorene Segmentdauer.

   Ein bestehender Präsentationstimer führt bestätigte Runden ohne weitere
   Einzelbestätigung aus.1× entspricht nominal einer Echtsekunde pro Runde;
   1/2/5/10× verändert nur diese Präsentation. Der Timer hält höchstens einen
   ursprünglichen Command offen und holt keine verstrichene Hintergrundzeit nach.
   Revision dient im Timer als monotone Rundenkennung, weil eine Runde mehrere
   Rasterpunkte oder nur einen Teilabschnitt umfassen kann. Ziel, Inhalte,
   Wahrnehmung und bestehende Reise-/Autonomypausen beenden die Fortsetzung;
   neuere gespeicherte Pausen bleiben auch beim Teilabschnitt erhalten.
   Navigation, Fenster-/Fokusverlust, neue Reisedaten und Neustart stoppen die
   lokale Wiedergabe. Danach ausdrücklich starten. Pause/Beenden wartet einen
   bereits gestarteten Command ab und verwendet dessen bestätigte Revision.

   Geprüft: exakte Teil-/Restzeit, ursprünglicher Receiptreplay, neue Rundendauer,
   Pause/Fresh/Kopie, Inhaltsunterbrechung und vorhandener serialisierter Timer.
   Native Runde, fortlaufende2×-Wiedergabe, Pause ohne Hintergrundbuchung,
   Neustart mit Teilfortschritt, eigene17Sekunden und Rasterpunktabschluss
   verwenden denselben Writer. Vollständige Trigger-/Autonomy-Catch-up-Grenzen,
   sehr große Routen, unbekannte UI-Antwortausgänge und physische Hostvarianten
   bleiben unabhängig zu qualifizieren. Keine zusätzliche Zellinterpolation
   oder erfundene Position zwischen authored Geometriegrenzen.
3. **Gemeinsamer Steuerungskontext geliefert.** Der gemeinsame Atlas enthält
   dieselben Dungeon-Steuerungen als eigenen aufklappbaren Reisebereich. In
   Leiten wandert dieser reale Bereich mit der vorhandenen Reisekonsole in die
   rechte Spalte; Raumtexte und Reiseaktionen bleiben auch bei angezeigter Szene
   erreichbar. Es wird kein zweiter Dungeon oder Reisestand angelegt. Die alte
   Fachkarte bleibt ausgeblendet. Bestätigte Raumposition, Höhe, verfügbare
   Ausrichtung, Gruppennamen und getrennte öffentliche/GM-/geheime Textblöcke
   stehen bei der laufenden Reise. Eine freie GM-Platzierung übernimmt keine
   Ausrichtung aus der früheren Route; diese wird als unbestimmt gezeigt. Tempo und Erkundungsrunde sind gebündelt;
   Wahrnehmung, Spuren, Passagen, Inhalte, Trigger und NPC-Pendinggrenzen benutzen
   ihre bisherigen Controls und Writer. Gruppenbildung/-teilung bleibt beim
   Live-/Rosterowner, NPC-Jobs bei Autonomy.

   Laden und Fokuswechsel sperren alte Aktionen sofort. Ein geänderter Fokus
   überschreibt keine offenen Tempowerte oder Spureingaben; Verwerfen und
   erneutes Laden übernehmen ausdrücklich den neuen Kontext. Eine erwartete
   Fokusantwort wird gegen ihre Scene-ID geprüft. Bestätigte Atlasplatzierung
   und lokale Bewegung aktualisieren auch den Dungeonlesekontext. Welt-, lokale
   und Dungeon-Position bleiben beim bisherigen Writer. Abgeschlossene oder
   abgebrochene Dungeonreisen zeichnen keine verbleibende Route; offene Routen
   enthalten den letzten bestätigten Punkt. Das ist UI-Komposition vorhandener
   Fähigkeiten, keine Lieferung dynamischer Akteurverfolgung, zusätzlicher
   Sonderbewegungsprofile oder neuer Autonomyjobs.

   Geprüft sind die vorhandenen Pace-/Round-/Atlasfälle und die tatsächliche
   Konsole mit eigenem Rundentakt, Wahrnehmung und blockiertem Fokuswechsel.
   Der isolierte native Ablauf bedient dieselben Controls bei angezeigter Szene
   und Karte, speichert17Sekunden-Teilfortschritt, pausiert, beendet die App
   regulär, startet neu, setzt weitere17Sekunden fort und bricht ab. Die exakte
   Gesamtzeit34Sekunden, unveränderte ursprüngliche Zellposition während des
   langen Abschnitts, aktives Wahrnehmungsergebnis und unveränderte
   Autorenzeichnung sind nach Fresh geprüft. Beide App-Prozesse enden regulär.
   Dies qualifiziert den beschriebenen Kernablauf, keine breite Indoor-,
   Betriebssystem-, Accessibility- oder Autonomygesamtprüfung.
4. **Zusammenhängend qualifizieren.** Native Ansichtwechsel, lange Texte, 100 %,
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
