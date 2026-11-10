# Aktueller Stand

Stand: 10. November 2026. **P3.1 „Wald und Lichtung“ ist implementiert und
fachlich geprüft.** Der [Neubauplan](atlas-rebuild-plan.md) bleibt der einzige
Ausführungsplan; [PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469)
bleibt Draft. Atlas V7 ist der reguläre Einstieg mit Dateiformat 22;
der optionale Electron-/Pixi-Editor verwendet jetzt Format 25.

## Arbeitsentscheidung

Der Nutzer hat die begrenzte R5-Fortsetzung ausdrücklich freigegeben und
anschließend P3.1 sowie dessen Bereinigung und Sicherung im Repository
beauftragt. Nur die dafür nötigen P1/P2-Erweiterungen gehören dazu.
Die formale R4-Auswertung bleibt bestehen; ihre offene Leistungsabnahme
widerruft diese begrenzte Nutzerentscheidung nicht. Vollständige P0-Abnahme und
bestandener gemeinsamer P3-Fall bleiben Voraussetzungen für P4–P9.

## P3.1 und aktueller Nachweis

Maskierte Landschaftsquellen mit vier Deckungswerten und festen Übersichten
verwenden dasselbe Dokument, Journal, Undo/Redo und denselben Dateipfad wie
Höhen. Fehlend erbt; explizit leer schützt die feine Lichtung vor grobem Wald.
Der begrenzte Pinsel erreicht im inneren Radius die gewählte Zieldichte in
einem Strich. Wasser maskiert die Darstellung und erhält die Autoren.

Up versiegelt die angenommene Aktion. Späteres Escape, Blur oder ein
Sichtbarkeitswechsel widerruft sie nicht; vor Up wird die sichtbare Vorschau
vollständig zurückgenommen. History und Dateiaktionen warten auf denselben
Abschluss. Darstellungscaches halten unveränderliche Eingaben und zählen alle
Puffer. Geänderte Landschaft erzwingt den Farbpass auch bei warmer Höhe und
nach einer unterbrochenen Vorbereitung. Beide Weltachsen ordnen die geschlossene
positive Grenze nach innen zu.

Der nach dem Verlust des ungesicherten Checkouts wiederaufgebaute Stand wurde
vollständig neu geprüft; frühere Testzahlen wurden nicht übernommen.
Geprüfter Produktquellhash (`product-inputs-v1`):

`b67e06519107ac210ad3bfc6603ad1ef134572f1895a63acba45e270c92eb7d9`

| Prüfung                                               | Ergebnis                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Gesamte TypeScript-Typprüfung                         | Bestanden.                                                                                       |
| Editor-Modell, Controller, Session und Darstellung    | 811/811 Tests in 26 Dateien bestanden.                                                           |
| Tool-Typprüfung und frischer P0-Desktop-Build         | Bestanden.                                                                                       |
| Echter Electron-/SQLite-Store und Skalierungsreferenz | 20/20 Tests bestanden.                                                                           |
| Vollständiger Electron-Smoke                          | 147/147 Prüfungen bestanden, einschließlich 27 Landschaftsprüfungen.                             |
| GPU-Pixelreferenz                                     | 6/6 Fälle bestanden, einschließlich aller 22 Höhenstufen, Weltgrenzen und endlicher Auslöschung. |
| Formatierung                                          | Alle 45 geänderten oder neuen Dateien geprüft.                                                   |

Der echte Landschaftsrundlauf prüft feine Lichtung → grobe Waldänderung →
Detailrückkehr → Undo/Redo → Save/Neu/Open und einen frischen Prozess ohne
Diagnosebindung. Neun dargestellte Punkte stimmen mit dem unabhängigen
Sampler der gespeicherten Quellen überein. Feine Landschaftsquellen und
sämtliche Höhenquellen bleiben bei der groben Waldänderung bytegleich.

Der begrenzte Quellenfall verwendet 520 feine Kacheln mit 10,15625 MiB bei
einem tatsächlich auf 80 KiB gesetzten Dokumentbudget. Eine zu große
Quellenübernahme wird atomar abgewiesen; der echte grobe Strich, Commit und ACK
bleiben mit vier Quellen innerhalb dieses Budgets, ohne feine Quellen zu lesen
oder zu übertragen. Das ist ein Funktionsnachweis der Arbeitsbegrenzung,
keine Lastabnahme am normalen 256-MiB-Budget.

Isolierte Negativkontrollen machen ausgelassene feine Ownership, Abbruch nach
Up, Verlust des versiegelten Zustands bei Pointerfreigabe und falsche
Weltkantenzuordnung tatsächlich rot; nach Wiederherstellung bestehen dieselben
Fälle. Die Produktdateien wurden für diese Kontrollen nicht verändert.

Rohbelege liegen ignoriert unter `src-tauri/target/diagnostics/p3-recovery/`,
`src-tauri/target/diagnostics/p3-landscape-recovery-negative-control/`,
`src-tauri/target/diagnostics/atlas-gpu-reference/` und
`artifacts/atlas-rebuild/smoke-2026-11-10T19-24-44.334Z/`.
Die GitHub-CI wird für den jeweiligen PR-Head separat ausgewiesen;
ein erfolgreicher Ausgangscommit ersetzt dessen Ergebnis nicht.

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

Als Nächstes folgt P3.2
„Ein echtes Haus“: rechteckiger, rotierbarer Hausheader mit stabiler ID, Pose
und Fundamenteinstellung; räumliches Laden, Auswahl und Verschieben mit
Abbruch, Undo/Redo und Reopen im gemeinsamen Pfad. Innenpayloads bleiben
getrennt. Gewässerquellen, reale Fachkonkurrenz und der gemeinsame Rundlauf
folgen innerhalb P3. K1–K6 bleiben erledigt; zusätzliche allgemeine
Konsolidierung ist keine vorgeschaltete Aufgabe.
