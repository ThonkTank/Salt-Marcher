# Aktueller Stand

Stand: 9. November 2026. R3 baut auf dem veröffentlichten R2-Stand
`15814025fd77dffa99fb5b2308e04d3bcb74e57e` auf.
Atlas V7 bleibt der reguläre Einstieg mit Dateiformat 22; der optionale
Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft;
der [Neubauplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan.

## Übergabe

**R3 ist funktional integriert. Die gemeinsame Leistungsabnahme von R2/R3 bleibt
offen; P0 ist nicht freigegeben.** Quellenübernahme, numerische Vorbereitung und
GPU-Arbeit werden vor Ausführung ausgewählt und begrenzt. Normale Kleinstwerte
bleiben auf der GPU. Echte numerische Ausnahmefälle verwenden einen Worker mit
gemeinsamer Jobzulassung und bestätigtem Abbruch.

C1 behält vollständige Eingabe, kausale Zeit, lokale Wirkungsreserve und den
atomaren Aktionsabschluss. Ein vollständiger älterer Renderstand R darf seine
Wirkung quittieren, während R+1 wartet. Up versiegelt die Eingabe; Undo und
Dateiaktionen warten weiterhin auf denselben vollständigen Modellabschluss.

## Umsetzung und Prüfzuordnung

| Kriterium                               | Umsetzung                                                                                                                                                                                         | Nachweis                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normale Zahlen und unveränderte Quellen | Nur skalierte GPU-Beträge unter `1e-30` werden zu null. Zusätzlicher kanonischer Fehler über 22 Stufen höchstens `7,04e-28` Fuß; Basisbudget bis höchstens 32 echten Übernahmen.                  | Encoding-, Fehlerbudget- und unabhängige Float64-Referenztests. Autorenwerte und Darstellungstoleranz `1e-6` bleiben unverändert.                                                                       |
| Auswahl vor Vorbereitung                | Lokaler räumlicher Quellenindex; nur neueste Quellen-/Übersichtsstände. Atomare Veröffentlichung nach kleinen Schritten, gemeinsames 2-ms-Budget und höchstens 128 Schritte pro RAF.              | Veraltete Übersichtsvorbereitung, zusammengefasste Deltas, tatsächliche Änderungen und eigene verspätete Reads; keine vorzeitige Fortschreibung der übernommenen Basis.                                 |
| Begrenzte GPU-Arbeit                    | Höchstens ein Terrain- und ein Scene-Slot. Auch Uploads/Allokationen erhalten Fence und Flush; vollständige Kompositionsschritte mit höchstens 16 Zeilen.                                         | Reine Uploads bei belegtem Scene-Slot, FIFO-Polling mit Timeout null, Kamera unter Last und vollständiger Scene-Receipt direkt nach dem letzten Terrainpaket.                                           |
| Lokale Wirkung und Hintergrundarbeit    | Eine eingefrorene lokale Einflussmenge, neuester Folgewunsch, unterbrechbare Hintergrundkachel und abgetrennter Ausnahmejob. DOM-Cursor ohne GL-Arbeit.                                           | R neben R+1, vollständige sichtbare Abdeckung, kalte unabhängige Gebiete, nicht quittierte Teilpakete und unveränderte C1-/Up-/History-/Save-Orakel.                                                    |
| Tatsächliche Ressourcenbindung          | Einzigartige geborgte Puffer, Vorbereitungsspitzen, Worker-Kopien und noch verwendete Altressourcen zählen zur Reserve.                                                                           | Verdrängung und Sessionwechsel bei laufender GPU, teilweise fehlgeschlagener Draw, fehlender Fence, Context Loss und Neuaufbau.                                                                         |
| Ausnahmejob außerhalb des UI-Threads    | Controller besitzt zwei gemeinsame Rechenplätze, höchstens eine Projektion und den neuesten wartenden Wunsch je Art. Eingaben in bestätigten 32-KiB-Schritten, Berechnung in kleinen Abschnitten. | Referenz über alle 22 Stufen, lokaler Vorrang, veraltetes Ergebnis, verspätete Abbruchbestätigung, abgetrennter Abbruch/Fehler und Worker-Absturz mit wartendem Auftrag.                                |
| Vollständige Auswertung                 | Rohe Terrain-, Scene- und Vorbereitungsereignisse pro Prozess. Arbeit zählt pro tatsächlichem Paket und RAF; Scene-Kopien zählen nicht doppelt.                                                   | Fehlende Messwerte, Upload ohne Scene, geteilte Überschreitung desselben RAF, dritte GL-Einreichung, Speicherüberschreitung und fehlende Vorbereitungsverknüpfung lassen das gemeinsame Gate scheitern. |

Der normale UI-Pfad besitzt keine synchrone kanonische CPU-Rasterung mehr.
Die vorhandenen synchronen Modell-/Referenzaufrufe und die Workerberechnung
verwenden dieselbe Fachmathematik. Ersetzt sind die unbudgetierte Vorbereitung
aller schmutzigen Kacheln und der einzelne gemeinsame GL-Platz.
Die Speicherbilanz zählt gehaltene physische Puffer und reservierte Spitzen;
sie ist keine Messung des gesamten JavaScript-Heaps oder des Grafiktreibers.

## Neu ausgeführte Verifikation

- **1.072 JavaScript-Tests in 61 Dateien bestanden.** Darin liegen 140
  Controller-/Renderer-/Beobachtungsprüfungen, 72 fokussierte Job-/Worker-/
  Referenzprüfungen und 180 Auswerter-/Timingtests mit absichtlich fehlerhaften
  Belegen. Eine zusätzliche Rust-Transportvertragssuite scheitert im Setup
  an fehlendem Cargo; deren fünf Tests sind übersprungen. Der Gesamtlauf ist
  deshalb nicht grün.
- Vollständige TypeScript- und Tool-Typprüfung sowie frischer P0-Desktop-Build
  bestanden.
- **15/15 reale SQLite-/Fixturetests und 120/120 reale Electron-Desktop-/
  Lifecycleprüfungen bestanden.** Stau, vollständige Restarbeit,
  Undo/Redo, Save/Reopen sowie Cancel/Save/Discard verwenden unveränderte
  Inhalts- und Abschlussbedingungen.
- **6/6 GPU-Referenzfälle mit 10 Ansichten, 190 Aktionen und 36 Kontrollpunkten
  bestanden.** Darunter liegen alle 22 Stufen, normale und extreme Auslöschung,
  Weltgrenzen und Kontextwiederherstellung. Der normale Level-9-Fall besteht: vier Skalen, acht Bearbeiten-/Undo-Aktionen, acht unabhängige
  Pixelkontrollpunkte, 295 beobachtete Draws mit null Fallbacks und exakt
  unveränderte Autorendaten nach Undo.
- Formatierung aller 37 geänderten Dateien und Diffprüfung bestanden.
- Lokale Rustprüfungen und `contracts:check` sind durch fehlendes Cargo blockiert
  (`spawnSync cargo ENOENT`); das zählt nicht als erfolgreicher Gate-Anteil.

Der abschließende Desktop-Build vom 9. November 2026, 22:25:09 UTC verwendet
Node 24.22.1 und Electron 44.10.2. Seine Produktquellen haben SHA-256
`987521c7085ca7ce707fc9360061d58ac76d8e1ef8da8312405de1035a5c5c7f`.
Der Build entstand mit lokalen Änderungen auf R2-Checkpoint `1581402`.
Die endgültigen Produktquellen wurden vor dem Commit erneut gegen diesen
Inhalt abgeglichen; nachfolgende Dokumentationspflege ändert sie nicht.
Prüflogs liegen unter `src-tauri/target/diagnostics/r3-verified/`, der
GPU-Report unter `src-tauri/target/diagnostics/atlas-gpu-reference/report.json`.
Der frische Smoke-Report liegt unter
`artifacts/atlas-rebuild/smoke-2026-11-09T22-25-11.924Z/report.json`.
Software-GPU-Läufe belegen Inhalt und Verhalten, keine qualifizierte Hardwarelatenz.

Für den veröffentlichten Head gilt **Candidate · exact-SHA aggregate** auf
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469/checks).
Ein historischer grüner Check wird nicht auf diesen Commit übertragen.

## Offene Grenzen und nächster Schritt

1. **CPU-Leistungsabnahme:** Der bekannte dichte R2-Eingabefall verfehlte das feste
   8-ms-p95-Ziel. Die R3-Strukturprüfungen ersetzen keinen neuen vollständigen
   Lauf auf qualifizierter Hardware. Tatsächliche Vorbereitungszeiten werden
   ungekürzt erfasst; Laborüberschreitungen bleiben sichtbar und führen bei
   qualifizierter nativer Abnahme zum Fehlschlag. Keine Absenkung von Eingaben,
   Wirkung oder Grenzwerten.
2. **R4-Hardwareprobe:** Höchstens 4 ms GPU pro Terrainpaket, Ergebnisabstand
   p95 höchstens 20 ms, Input→Submit p95 höchstens 50 ms und mindestens 90 Prozent
   Referenzwirkung sind gemeinsam zu belegen. Zwei Slots und harte Arbeitszähler
   belegen diese Zeiten allein nicht.
3. **R5 und native Freigabe:** Tatsächliche Präsentation, installierte
   Paketabnahme und der gemeinsame kleine Fachfall sind weiterhin offen.
   Kein allgemeiner Werkzeugausbau oder P0-Freigabe aus diesem R3-Auftrag.

Nächster Schritt ist die gemeinsame CPU-/GPU-Richtungsprobe des integrierten
C1- und R3-Pfads auf geeigneter Hardware. Quellenmathematik, unabhängige
Inhaltsreferenz, Stärkeanker und Zeitziele bleiben unverändert.
