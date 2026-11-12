# Aktueller Stand

Stand: 12. November 2026. **Der Landschaftspinsel im optionalen Electron-/Pixi-Editor
behält bereits gemalte Strichabschnitte bei Fehlern, verarbeitet Eingaben in
geometrischen Batches und aktualisiert die Darstellung lokal. Der Fachstand
bleibt P3.3.** Die vorangehenden Höhen-UI-Änderungen einschließlich Moduserinnerung,
`[`/`]` und Alt+Mausrad sind enthalten. Eine zusätzliche Leertaste-Ziehen-Geste
wurde nicht eingeführt. Atlas V7 bleibt der reguläre Tauri-Einstieg mit Format 22;
der optionale Editor verwendet weiterhin Format 27 (`atlas-p3-derived-water-1`).

Die Umsetzung liegt auf dem lokalen Zweig `work/landscape-painting-20261112`,
Produktcommit `fc92ec7c783ac4f10792d457e6f2a9af2bbcef29`. Ausgangspunkt ist
`3c6e649` mit den bereits abgeschlossenen Höhen-UI-Änderungen. Der gemeinsame
Remote-Zweig `work/atlas-p0-feasibility` wurde als `fb6e22e` zurückgelesen;
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Verhalten

- Bereits materialisierte Landschaft bleibt bei fehlenden Nachbardaten,
  Kapazitäts- und Projektionsfehlern erhalten, auch nach Pointer-up. Die Aktion
  bleibt rückgängig machbar und gelangt über den bestehenden Writer in die
  Arbeitskopie. Ein dauerhaft fehlschlagender GPU-Abschluss blockiert ihre
  Dokument- und Save-Barriere nicht mehr. GPU-Ressourcen bleiben bis zu ihrem
  sicheren Abschluss gehalten.
- Nur ausdrückliches Escape vor Up nimmt den laufenden Strich vollständig zurück.
  Fokusverlust, Pointercancel, Navigation und Werkzeugwechsel schließen den
  geeigneten Weg ab. Abgewiesene Bewegung wird nach dem Laden nicht nachgeholt.
- Der Controller verarbeitet je RAF bis zu 64 Wegabschnitte mit höchstens 16.384
  konservativ geschätzten Kandidatenzellen. Kollineare Vorwärtsstücke werden nur
  bei vollständig bekannter gemeinsamer Quellenfläche zusammengefasst; Ecken,
  Umkehrpunkte und Endpunkt bleiben erhalten. Ein 3×3-Autorenumfeld mit gerichteter
  Erweiterung auf 4×4 wird vorgeladen. Die begrenzte Eingabeliste enthält offene
  Geometrie; angenommene Autoren gehören bereits dem Dokument.
- Pro Batch wird jede geänderte Quellkachel einmal kopiert. Ein privater Sampler
  indexiert nach vollständiger Bereitschaftsprüfung nur relevante vorhandene
  Quellen und Stufen. Er prüft nicht für jede Zelle erneut alle fehlenden Stufen.
- `LandscapeView` übernimmt konkrete unveränderliche Patches und hält lokale
  Übersichten nach ACK aktuell. `HeightField` kodiert und überträgt bei passender
  Versionsabstammung nur geänderte Texelbereiche. Reine Farbänderungen verwenden
  einen vollständigen kompatiblen GPU-Höhenstand weiter. Ein erfolgreicher Read
  weckt wartende Darstellungsarbeit auch bei unverändertem Cacheinhalt.

Geometrie, Zieldichte, feinster Besitzer, explizite Lichtung, Wasser-Maskierung
und genau ein Undo-Schritt pro verändertem Strich bleiben erhalten. History,
Dateiformat und ein einziger geordneter Writer werden weiterverwendet. Es wurde
kein zweites Dokument oder werkzeugeigenes Schreibjournal eingeführt.

## Nachweis am endgültigen Produktstand

Der saubere Build gehört zu `fc92ec7`. Produktquellhash (`product-inputs-v1`):
`811ae283f5bd19ad1fc95b61c802caf9d5dfdadb81a2f17b7617bb25a8cdf682`.
Der Hash wurde aus den aktuellen Produktdateien erneut berechnet und stimmt mit
`desktop-dist/build.json` überein. Der nachfolgende Abschlusscommit ändert nur
dieses Statusdokument.

| Prüfung                                          | Ergebnis                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `npm run build:atlas-p0`                         | PASS; Editor-TypeScript, Vite, Desktopbundles und echte Electron-/SQLite-ABI-Probe             |
| `npm run test:atlas-p0 -- --reporter dot`        | **1.020/1.020 PASS**, 32 Dateien                                                               |
| `npm run typecheck:p0-tools`                     | PASS                                                                                           |
| Echte SQLite-Storetests                          | **26/26 PASS**, einschließlich atomarer Landschaftsänderung, Replay, Snapshot und Wiederöffnen |
| Normaler Desktop-Smoke am endgültigen Build      | **103/103 PASS**: Start/Datei 13, Landschaft 35, Häuser 29, Gewässer 26                        |
| Format, JavaScript-Syntax und `git diff --check` | PASS                                                                                           |

Die Landschaftsprüfung enthält jetzt einen gehaltenen Weg mit 320 Bewegungssamples,
zwei Samples pro RAF, über positive und negative Kachelgrenzen. Sie prüft
Anfang, Kurven und Endpunkt, wirkliche Canvaspixel, gemeinsames Undo/Redo und
unabhängig gelesene gespeicherte Autorenwerte. Der vorhandene Fall prüft zusätzlich
feine Lichtung über grobem Wald, spätere grobe Änderungen, Escape, Save/Open und
einen frischen Prozess ohne Diagnosebindung. Die Höhenbytes bleiben identisch.
Die neuen Screenshots wurden visuell geprüft.

**Negative Kontrolle:** Derselbe neue Dauermal-Prüfer scheiterte am unveränderten
Ausgangsbuild `3c6e649` nach 142 Samples mit der bisherigen Bereitschaftsfehlermeldung.
Der aktive Landschaftsbestand war danach vollständig zurückgenommen, ohne
History-Aktion. Am endgültigen Build bestehen alle 320 Samples und der vollständige
Undo-/Redo-/Save-Ablauf. Der Prüfer ist Bestandteil des bestehenden Paket-Smokes.

Während der Integration wurden zwei weitere konkrete Übergänge korrigiert und
regressionsgeprüft: vollständige Texturwiederherstellung nach Kontextverlust
zwischen Kodierung und erstem Upload sowie das fehlende Aufwecken des Renderers
nach einem Undo-Nachladen. Der native Undo-Fall war vor diesem Wake-up-Fix nach
30 Sekunden noch auf dem vorherigen Bildstand; derselbe Fall besteht jetzt im
vollständigen 103er-Lauf. Keine Prüfung wurde abgeschaltet oder zeitlich gelockert.

Gezielte Controllerprüfungen decken außerdem 1.000 kollineare Samples vor einem
RAF, 192 Kurvensamples in zwölf RAFs, kalte Nachbarn, Kapazitätsfehler nach Up,
Projektionsfehler, dauerhaft fehlschlagendes GPU-Polling mit verzögerter
Speicherquittung sowie frühere Striche und Save-/History-Barrieren ab.

## Gemessene Arbeit und Grenzen

Vergleich gegen `3c6e649`: identischer Weg aus 32 Segmenten, Radius 8, Autorenstufe 0,
sechs Aufwärmrunden und 21 abwechselnde Messrunden je Fall. Gemessen wird die
summierte Modellarbeit der alten Einzelsegment-API gegenüber dem neuen Batch.
Endgültige Masken-/Gewichte-Hashes, Quellen- und Historybytes, Zell-/Kachelzahl
und eine History-Aktion stimmen in jeder Vergleichsrunde exakt überein.

| Modellfall                       | Alter Median | Neuer Median |
| -------------------------------- | ------------ | ------------ |
| Leere, vollständig bekannte Welt | 128,75 ms    | 13,50 ms     |
| Vererbung gröberer Landschaft    | 26,37 ms     | 11,88 ms     |
| Bereits lokal bemalte Quellen    | 12,41 ms     | 13,00 ms     |

Das belegt etwa 9,5× beziehungsweise 2,2× schnellere Modellarbeit in den ersten
beiden Fällen; im dritten Fall ist kein Geschwindigkeitsgewinn belegt. Die Werte
sind keine Eingabe-zu-Bild-Zeiten und keine pauschale Beschleunigung der Anwendung.
Im endgültigen nativen Dauermal-Fall wurden tatsächlich Farbpasses ausgeführt,
**ohne kanonische oder inkrementelle Höhenprojektion, horizontale Projektion oder
Projektionsprodukte**. Übertragen wurden 291.492 Bytes Landschaftsdaten im
beobachteten Zeichenintervall; die partiellen Uploads sind zusätzlich am echten
Uploader-Aufruf regressionsgeprüft.

Der Desktoplauf verwendet echte Electron-/Pixi-/SQLite-Pfade mit Softwaregrafik.
Seine 160 beobachteten Zeichenframes hatten CPU-p95 11,1 ms und Intervall-p95
33,4 ms. Das ist **keine bestandene native 8-/20-ms- oder Hardwareabnahme**.
Der CPU-Projektionsfallback bleibt korrekt, berechnet bei Landschaftsänderungen
aber weiterhin vollständig; die reine Farbwiederverwendung setzt unterstützte
numerische GPU-Ziele und geeignete Höhenwerte voraus. Die bestehenden Speicher-
und Aktionsgrenzen bleiben erhalten; ein Überlauf erhält den gemalten Anfang.
Ein zusätzlicher Langstrich-Spill oder zweiter Speicherpfad wurde nicht eingeführt.

Lokale Nachweise liegen ignoriert unter `src-tauri/target/diagnostics/`:
`landscape-final-verified/`, `landscape-batch-review/` sowie die ersten
Integrationsläufe. Die negative Kontrolle liegt im separaten Baseline-Worktree
unter `src-tauri/target/diagnostics/landscape-negative-control/`.

## Übertragung und nächste Übergabe

Der Nutzer hat Push und Veröffentlichung am 12. November ausdrücklich
freigegeben. Die neue Electron-Vorschau erhält Version **0.3.3**; geändert
werden ausschließlich die Paketversion und die beiden Root-Versionsfelder
der Lockdatei. Die oben nachgewiesene Programmlogik bleibt identisch. Der
Versionswechsel ändert den Produktquellhash; der endgültige Paket- und
Veröffentlichungsnachweis wird an den neuen Build gebunden.

Der geprüfte Stand einschließlich der vorherigen Höhen-UI-Commits wird in
`work/atlas-p0-feasibility` übernommen. Der vorhandene Workflow muss das
tatsächliche RPM/ZIP und den gepackten Update-Dialog erfolgreich prüfen,
bevor der Vorschaukanal aktualisiert wird. Die Veröffentlichung ist an diesem
Vorbereitungsstand noch ausstehend.

Der letzte vollständige Höhen-GPU-Referenzlauf aus P3.2 bleibt historisch
**FAIL, 3/6**; R4-Halten und die native Hardware-/Eingabelatenzabnahme bleiben offen.
Der frühere sporadische Gewässer-Timeout ist durch diesen erfolgreichen Lauf
nicht kausal erklärt. Live-Feedfehler `net::ERR_EMPTY_RESPONSE` und eine wirkliche
Fedora-DNF-/Polkit-Installation bleiben getrennte offene Nachweise. Diese
Landschaftskorrektur aktiviert keine weiteren V7-Funktionen oder P4–P9-Schritte.
Der nächste Fachschritt bleibt **P3.4 „Echte Fachkonkurrenz“** im einzigen
[Neubauplan](atlas-rebuild-plan.md).
