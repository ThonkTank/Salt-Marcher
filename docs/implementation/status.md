# Aktueller Stand

Stand: 10. November 2026. Ausgangspunkt ist der gesicherte
[Bereinigungscommit `6357f2c`](https://github.com/ThonkTank/Salt-Marcher/commit/6357f2c1b99d378fa0bc08dabb096c63ecbc6dc1).
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.
Atlas V7 ist der reguläre Einstieg mit Dateiformat 22; der optionale
Electron-/Pixi-Editor wird für P3.1 auf Format 25 erweitert.
Der [Neubauplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan.

## Arbeitsentscheidung

Der Nutzer hat die begrenzte R5-Fortsetzung ausdrücklich freigegeben und
anschließend P3.1 „Wald und Lichtung“ sowie dessen Bereinigung und Sicherung
im Repository beauftragt. Nur die dafür nötigen P1/P2-Erweiterungen gehören dazu.
Die formale R4-Auswertung bleibt bestehen; ihre offene Leistungsabnahme
widerruft diese begrenzte Nutzerentscheidung nicht. Vollständige P0-Abnahme und
bestandener gemeinsamer P3-Fall bleiben Voraussetzungen für P4–P9.

## P3.1 und aktueller Nachweis

P3.1 verbindet maskierte Landschaftsquellen, vier Deckungswerte und feste
Übersichten mit dem gemeinsamen Dokument, Journal, Undo/Redo und Dateipfad.
Fehlend erbt; explizit leer schützt eine feine Lichtung vor grobem Wald.
Der kleine Pinsel, sichtbare Rücknahme und Landschaft über Wasser/Land gehören
zu demselben Fachfall. Der Höhen-C1-Vertrag bleibt erhalten.

**Dieser Sicherungsstand ist noch nicht abschließend geprüft.** Nach dem
Ausfall der vorherigen Arbeitsumgebung war deren ungesicherter Checkout nicht
mehr verfügbar. Die Änderungen werden am gesicherten Ausgangscommit erneut
aufgebaut. Frühere grüne Testzahlen sind keine Nachweise für diesen neuen Stand.

Bereits frisch geprüft sind die unabhängige Landschaftsreferenz mit 13 Fällen
und Höhenprojektion/Landmaske mit 17 Fällen. Die isolierte Negativkontrolle
scheitert bei ausgelassener feiner Ownership und besteht nach Wiederherstellung.
Gesamte Typprüfung, Editor-/Storetests, Desktop-/Dateirundlauf, GPU-Referenz und
abschließende Veröffentlichung bleiben bis zu ihren neuen Ergebnissen offen.
Rohbelege liegen ignoriert unter `src-tauri/target/diagnostics/p3-recovery/`
und `src-tauri/target/diagnostics/p3-landscape-recovery-negative-control/`.

## Offene Messbefunde

Der letzte R4-Haltebefund bleibt **FAIL**: Bei zehn Sekunden auf Level 4,
Scale 0,01 und 16-Pixel-Pinsel erreichte das Zentrum 200 statt 40.038,4
Referenzwirkung, ungefähr 0,5 Prozent. Während des Haltens wurde kein neues
Terrainpaket eingereicht. Die bisherige Codeableitung benennt wiederholt
verworfene Übersichtsvorbereitung mit mindestens 133 Schritten bei höchstens
128 Schritten je RAF. P3.1 ist keine neue Abnahme dieses Höhenfalls.

Der native Hardware-/20-ms-Ergebnistakt und die vollständige
Eingabe→Präsentationsabnahme bleiben offen. Funktions-/Pixelprüfungen ersetzen
keine native Leistungsabnahme.

## Nächster Planschritt

Zuerst den wiederhergestellten P3.1-Stand vollständig prüfen und sichern:
feine Lichtung → grobe Waldänderung → Detailrückkehr → Undo/Redo →
Save/Neustart/Reopen; gespeicherte und dargestellte Werte gegen die unabhängige
Referenz, gemeinsame Aktionsbarrieren und begrenzte Quellenarbeit nachweisen.
Danach folgt P3.2 „Ein echtes Haus“ mit räumlichem Hausheader und demselben
History-/Dateipfad. Gewässerquellen, reale Fachkonkurrenz und der gemeinsame
Rundlauf folgen innerhalb P3. K1–K6 bleiben erledigt; zusätzliche allgemeine
Konsolidierung ist keine vorgeschaltete Aufgabe.
