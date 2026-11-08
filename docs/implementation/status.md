# Aktueller Stand

Stand: 8. November 2026. Regulärer Produkteinstieg bleibt Atlas V7 mit
Dateiformat 22 und Generierungsrezept 4. Der optionale Electron-/Pixi-Höhenversuch
verwendet Format 24 (`atlas-p0-height-2`). [README](../../README.md) enthält
Befehle, [Architektur](../architecture.md) Zuständigkeiten und
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Ergebnis und Auftragsgrenze

Der vollständige [Aufräumplan](atlas-rebuild-plan.md) P0–P9 wurde beauftragt.
Das bisherige Aufräumen an Prüf-, Render- und Übersichtspfad ist implementiert.
Die ausdrücklich ergänzte D10 ist
implementiert und funktional geprüft: **Halten wirkt weiter, langsamere Züge
wirken stärker, verzögerte Verarbeitung sammelt keine große Nachholdosis an.**
Die frühere 512-Quellen-Sperre grober Ansichten ist durch numerische Übersichten
behoben; 32, 1.024 und 9.000 echte Quellen bestehen den Funktionsrundlauf.

**P0 ist dennoch nicht abgeschlossen.** Große warme Gesten verfehlen im
Software-Labor weiterhin Reaktionsziele. Die kalten Altproben verwenden nur
Quellenbereitschaft; sie erfüllen den nachstehend präzisierten Vertrag nicht. Native
Präsentation und qualifizierte Referenz fehlen. Der vollständige Ausbau P1–P9
bleibt gemäß Plan am P0-Gate; F01–F19 ist im kleinen Höheneditor nicht vollständig
umgesetzt. V7 bleibt der reguläre Einstieg. Eine generelle Überlegenheit von
Electron/Pixi gegenüber V7 ist nicht belegt.

**Aktueller Planungsauftrag nach dem Review:** Aaron bestätigt ausdrücklich,
dass unsichtbares Gelände nicht bearbeitbar sein soll. Der Wartezustand muss
sichtbar sein und möglichst kurz bleiben. Die geplante D11 verbindet deshalb
angezeigtes lokales Terrain mit den benötigten Daten. Als Vereinfachung werden
vor Freigabe begonnene Gesten nicht vorgemerkt; ein neuer Druck beginnt die
Bearbeitung. Diese Änderung, die Rasterpriorität und Reads während Save sind
geplant, noch nicht implementiert. Produktcode, Prüfprogramme und Lockdatei
bleiben auf dem Stand `ecbad25`/`b0f1587`.

Die folgenden Messwerte und PASS/FAIL-Angaben beschreiben unverändert den damaligen
ausgeführten Stand und Vertrag. Sie werden nicht nachträglich umgedeutet. Insbesondere
belegen die alten kalten Fälle keine korrekte D11-Sperre: Die erste Modelländerung
geschah bereits vor der passenden Bilddarstellung.

## Umgesetzter Kern

- Die reine Höhenmathematik integriert die ausdrücklich angenommene Zeit entlang
  des Wegs mit dem bestehenden quartischen Kern. Ein gemeinsamer Controllerpfad
  begrenzt jeden Schritt auf 50 ms und lässt höchstens eine ausstehende Dosis zu.
  Ein kleiner nominaler Pressimpuls erhält Klicks. Quellen-/Darstellungspausen,
  überschüssige Zeit und verspätete Eingaben erzeugen keinen späteren Auftrag.
  Loslassen oder Abbruch beendet weitere Wirkung; der angenommene Strich ist
  eine Undo-Aktion. Schnelle Klickfolgen, Ortswechsel und Resize sind abgesichert.
- Quellenpatches ersetzen volle Kopien je Eingabe. Ein gemeinsamer Frameablauf
  übernimmt und zeichnet fertige Ergebnisse vor der nächsten Dosis. Begrenzte
  Rasterbatches und monotone sichtbare Revisionen verhindern fortwährendes
  Verwerfen fertiger Arbeit. Versionsabdeckung und aktuell exakte Region bleiben
  getrennt; keine Diagnosemeldung setzt eine Produktbereitschaft.
- Numerische Übersichten erhalten feine Höhenbeiträge in grober Darstellung.
  Exakte Reads begrenzen Raum und Stufe bereits im SQLite-RTree. Autoren und
  Übersichtsvorfahren werden atomar geschrieben. Lokale Patches überbrücken noch
  nicht bestätigte Sequenzen; Quellen-, History-, Pending- und Cachebudgets sind
  begrenzt. Die Grenze von 512 Autorenkacheln je Aktion greift vor der Mutation.
- Effektive Einstellungen liegen im Controller; React hält nur Zahltextentwürfe.
  Der normale Start sammelt keine Atlas-Journale oder synthetische Last.
  Die Prüfung verwendet gemeinsame echte Eingabeprogramme, ein Rohjournal je
  Prozess, sofortige Ergebnisse und ausdrücklich erhaltene Fehl-/Teilversuche.

## Identität und Nachweise

Die Hauptreihe der Produktproben stammt aus dem sauber gebauten Kandidaten:

| Identität                      | Wert                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| Ausgeführter Codecommit        | `8849edf70424d06223da22e712c0eec55c5ace8d`                         |
| Produktquellen SHA-256         | `441fad6ff6a5bc51815f8fc866a664974e92a8060f59c0b8a75c6330d252d333` |
| Lockdatei SHA-256              | `8f90d72914d5d7599759b5d117e4c40457f883f4213f870940a1167db6a17839` |
| Gebauter Programmstand SHA-256 | `36a3e4c65a9b4f4849283669b1d7e9b56e9e25f870b6b7bd654e09151c7a6755` |

Zusätzlich wurde ein eigenständig startbares Linux-Anwendungsverzeichnis aus
`43583f1667d11f6e6ab4234d0758f613a4a7b1e7` gebaut und tatsächlich ausgeführt.
`packaged: true` und die aus dem ausgeführten ASAR gelesene Buildidentität wurden
bestätigt; Produktquellen und Lockdatei sind identisch mit der Hauptreihe.
Paket-SHA-256: `0c175285cd1fb62e9a435562932a6586fef6787be849e4abc9a81ba4b1c3f153`.

Nachfolgende Änderungen betreffen Prüfprogramm und Dokumentation; Produktquellen
und Lockdatei bleiben identisch. Jeder Bericht nennt den tatsächlich ausgeführten
Build und seinen jeweiligen Harnesshash. Der Lauf verwendet Electron 44.10.2
mit ANGLE/SwiftShader im Headless-Modus, keinen qualifizierten nativen Bildschirm.

| Prüfung                                               | Ergebnis und Aussagegrenze                                                                                                                                                     | Belegpfad                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Gemeinsame Modell-/Raster-/Renderer-/Auswerterprüfung | 165 Tests bestanden; Typen beider Einstiege, Format und Diff sauber.                                                                                                           | `src-tauri/target/diagnostics/cleanup-time-checks/unit-final.log`  |
| SQLite und Skalierungsfixtures in Electron            | 14 Tests bestanden einschließlich atomarer Fehler, echter Datei und begrenztem Übersichtsread.                                                                                 | `cleanup-time-checks/store-build.log` unter demselben Diagnosepfad |
| Tatsächlicher 500-ms-Renderer-Hänger                  | 26 Checks in zwei Fällen bestanden: Loslassen während des Hängers oder danach weiter halten; echte Ereignisse, Zeitbilanz, unabhängige Höhe, spätere Ruhe und ein Undo.        | `cleanup-stall-final/`                                             |
| Normalstart ohne Diagnose                             | 14 Checks bestanden: Zahlentwürfe, echte Pinsel-/Historypixel, Speichern und Öffnen, keine Diagnose-API/-Marks.                                                                | `cleanup-normal-time-final-3/`                                     |
| M01 und funktionaler Coastworkflow                    | 16 Checks und fünf Fehlerkontrollen bestanden; gehaltene Wirkung, längere Dauer, langsamer Weg, Detailrückkehr, History und Neustart.                                          | `time-behavior-final/`                                             |
| 32 / 1.024 / 9.000 Quellen                            | Alle drei Fälle bestanden: Küsten-/Reliefpixel, Feindaten-Digest, exakte Werte, Undo/Redo, Save und Prozessneustart.                                                           | `time-scaling-final/`                                              |
| Eigenständiges Anwendungspaket                        | Forge-Paket gebaut und tatsächlich gestartet; M03-small mit Inhalt, Undo und strengen Submission-Proxies bestanden. `PROXY_ONLY`, keine RPM-Installation oder native Freigabe. | `time-packaged-small/`                                             |

Die kurzen Belegpfade der Funktionstests liegen unter
`artifacts/atlas-rebuild/`. Die Normalstart-Vorläufer bleiben erhalten: Der
Hilfsscript hatte vor der tatsächlichen Grid-off-Darstellung beziehungsweise
vor dem letzten angenommenen Pinselschritt fotografiert. Der korrigierte reine
Funktionscheck wartet auf stabile tatsächliche Pixel; Zeitmessungen wurden
nicht verändert.

### Zeitabhängige Wirkung und Rückstau

Beim wirklichen 500-ms-Hänger lag das native Loslassen mitten im blockierten
Intervall; sein Handler kam erst rund 410,5 ms später an. **Keine der 500 ms wurde
als Dosis angenommen.** Beim Weiterhalten wurden 49 ms dieses Hängers in einem
auf insgesamt 50 ms begrenzten Schritt berücksichtigt und 451 ms verworfen.
Es gab keine aufgestaute Folge von Nachholschritten. Die Höhen stimmten mit der
unabhängig berechneten angenommenen Dosis überein; danach änderte sich 600 ms
lang nichts mehr. Je ein Undo stellte Modell und Bild wieder her.

Bei 500/1000 ms normalem Halten betrug das Verhältnis angenommener Dosis und
Höhenwirkung jeweils 2,095. Derselbe Weg mit 24/48 ms Abstand nahm 97,87/191,67 ms
Dosis an; die Summe der vier geprüften Höhenänderungen war beim langsameren Zug
1,875-mal so groß. Das sind gezielte funktionale Beispiele, keine Zusage exakt
bildratenunabhängiger Wirkung. Die nominale Pressdosis wird separat bilanziert.

### Kurze Gesten und verbleibende Leistungslücken

Die kurzen Collectionfälle verwenden einheitlich **4.000 ft/s = 1.219,2 m/s**.
Die bestehenden Eingabeprogramme bleiben unverändert: vier Punkte im warmen
Fall, fünf im kalten Monitor, jeweils mit den bisherigen Intervallen. Die erste
Probe mit 1.000 ft/s bleibt in `time-collection-final/` als FAIL erhalten: Das
letzte kanonische Ziel lag bei +0,007 ft, sein tatsächliches Rasterzentrum aber
bei −0,142 ft; dessen Wasserfarbe war korrekt unverändert. Eine unabhängige
Nachrechnung begründet die feste höhere Prüf-Stärke. Weder Geometrie, Dauer,
Vorwärmung, Inhaltsprüfung noch Zeitgrenze wurden zugunsten eines PASS geändert.

Die folgenden Werte stammen aus je einer gezielten kurzen Probe. **Render-Submit
ist nur ein unterer Zeitwert für Präsentation; dies sind keine nativen p95-Reihen.**

| Fall                              | Beobachtetes Ergebnis                                                                                                                                                                                                                    | Belegpfad                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| M03 klein, 16 px                  | Inhalt, Undo und Dosisbilanz bestanden; vier echte Zwischenframes. Eingabe → Submit p95 33,7 ms, Up → Submit 49,6 ms. `PROXY_ONLY`.                                                                                                      | `time-short-small/`                    |
| M03 groß, 256 px                  | Inhalt, Undo und Dosisbilanz bestanden, zwei Zwischenframes. Ein Move während `feedback` nicht angenommen; Edit p95 100,9 ms, Up 51,0 ms. **FAIL**.                                                                                      | `time-short-large/`                    |
| M04 grob über fein                | Inhalt, Undo und Dosisbilanz bestanden; drei Zwischenframes. Edit p95 37,4 ms, Up 6,9 ms. `PROXY_ONLY`.                                                                                                                                  | `time-coarse-fine/`                    |
| M06 Bearbeitung unter realer Last | Im abschließenden einzelnen Strich echte Input-/Modell-/Save-/Worker-Überlappung, Inhalt, Undo und Zeitbilanz bestanden; drei Zwischenframes. Edit p95 37,3 ms, Up 9,0 ms. `PROXY_ONLY`. Früherer realer `stale`-Fehler bleibt erhalten. | `time-busy-final/`, zuvor `time-busy/` |
| M10 kalter Ort                    | Bereitschaft nach 23,7 ms, erste Änderung nach 216,3 ms. Nur Pressdosis angenommen; vier Moves wegen ausstehender Darstellung verworfen, kein Zwischenframe vor Up. **FAIL**.                                                            | `time-cold/`                           |
| M10 kalter Ort unter Last         | Bereitschaft nach 509,4 ms statt höchstens 500 ms; erste Änderung nach 690,5 ms. Ebenfalls vier verworfene Moves und kein Zwischenframe. **FAIL**.                                                                                       | `time-cold-busy/`                      |

Alle Pfade dieser Tabelle liegen unter `artifacts/atlas-rebuild/`. Absichtlich
verworfene Eingaben erhalten einen Grund und keinen erfundenen Modell-/Submit-
Beleg. Die sichere Dosisbegrenzung macht die weiterhin langsamen Fälle nicht zu
einer bestandenen Leistungsabnahme. Die beiden kalten Originalberichte enthalten
den vollständigen fehlerhaften Verlauf im jeweiligen `attempt.stroke`;
die M10-Latenz bezieht sich auf den ersten Input. Der abschließend korrigierte
Auswerter verwendet für den Live-Verlauf alle gespeicherten Eingaben und trennt
Lastüberlappung von vollständiger Input-/Submit-Abnahme. Eine bereits ausgelöste
Geste wird nicht durch eine zusätzliche Rettungsgeste ersetzt. Die reine
Neuauswertung lässt sämtliche bisherigen FAILs bestehen.

### Langer laufender Pinsel

Die zusätzliche 41-Punkte-Geste mit unverändert 24 ms Abstand und 1.000 ft/s
belegt im kleinen/großen Pinsel **41/37 tatsächlich eingereichte aktuelle
Dosis-Zwischenframes vor Loslassen**. Endpunktbilder, alle 41 kanonischen
Undo-Proben, Dosisbilanz und vollständige Journale bestehen. Die größte
beobachtete Bewegungspause liegt bei 50,2/76,3 ms.

Beide Fälle bleiben dennoch **FAIL**: 4/8 der 41 echten Edit-Eingaben wurden
bewusst nicht angenommen; die übrigen erreichen Edit-p95 61,2/76,3 ms bis zum
Submit. Beim großen Pinsel braucht Up 97,2 ms. Es gibt kein Gesamt-PASS und
keinen Ersatz der kurzen Pflichtgeste. Beleg:
`artifacts/atlas-rebuild/cleanup-continuous-time-final/`.

Die numerische Übersicht meldet ihre Pflegekosten weiterhin mit: Die gesamte
vierstufige grobe Navigation liest bei 32/1.024/9.000 Quellen
5,625/9,125/20,75 MiB; die anschließende grobe Bearbeitung braucht keine weiteren
Reads. Für Bearbeitung, Undo und Redo zusammen entstehen 3 Commits mit 12
Autorenwrites, 2,75/3,875/5 MiB Übersichtsreads und 4,75/5/5,5 MiB
Übersichtswrites. Der dabei beobachtete Schreibcache erreicht jeweils 2 MiB.
Diese Summen sind nicht als Kosten eines einzelnen letzten Übersichtsreads
zu verstehen.

Die erneute native Vorprüfung endet vor Fixtureerzeugung mit Exit 2 und
`NO_NATIVE_DISPLAY`; Beleg `artifacts/atlas-rebuild/time-native-preflight/`.

## Offene Abnahme und Fortsetzung

Den lokalen Datenkern und die numerischen Übersichten behalten. Der nächste
Auftrag steht einmal in [Planabschnitt 5](atlas-rebuild-plan.md#5-arbeitspakete-und-abhängigkeiten):
P0a/D11 festlegen, P0b/Freigabe und gemeinsame Prüfregeln umsetzen, dann
P0d/Rasterreihenfolge und P0f/Reads während Save. Je Paket ersetzte Zustände,
Wartepfade und Tests entfernen; keine zweite Vorschau, kein weiterer Worker und
kein allgemeines Scheduling-Framework.

Die Review-Auswertung vorhandener Rohjournale grenzt zwei Warteketten ein:

- `time-cold`: Quellen nach 23,7 ms bereit, Modelledit nach weiteren 6,6 ms.
  Danach vier Rasterbatches ohne geänderte Kachel; der erste betroffene Batch
  beginnt etwa 117 ms nach der Modelländerung. D11 verlangt zuerst sichtbares
  Terrain; lokale Priorität soll diese Wartephase verkürzen, keine unsichtbare
  Bearbeitung vorziehen. `WorldRenderer.dispatch` bevorzugt bisher gemalte
  Kacheln; neue Kacheln haben keinen Bezug zum lokalen Arbeitsbereich.
- `time-cold-busy`: Der 504,7-ms-Snapshot beginnt 1,3 ms vor der Navigation;
  Quellen treffen 4,4 ms nach seinem Ende ein. Zusammen mit der pauschalen
  Promise-Queue in `store-process.ts` erklärt dies sehr plausibel fast die
  gesamte 509,4-ms-Quellenbereitschaft. Synchrone reine Reads sollen diese Queue
  umgehen; geordnete Mutationen und konsistenter Snapshot bleiben erhalten.

Die Belege liegen unverändert in den bereits genannten `artifacts/atlas-rebuild/`-
Unterordnern; dies ist eine Auswertung, keine neue Produktmessung. Der warme große
Pinsel bleibt ein eigener Fall mit verteilter Eingabe-, Raster- und Framezeit.

Neue M10-Proben messen Navigation → **sichtbar lokal bereit** bei p95 ≤500 ms,
anschließend normale Eingabe → exaktes Ergebnis bei p95 ≤50 ms und die vollständige
Navigation → erste Änderung bei p95 ≤750 ms. Die 2.000-ms-Maxima und die
100-ms-Fortschrittsgrenze bleiben. Frühe abgewiesene Eingaben werden separat auf
sichtbares Warten und ausbleibendes Replay geprüft. Native Präsentationszuordnung
und qualifizierte Referenz fehlen weiterhin; Softwaregrafik, RAF und Submission
ersetzen sie nicht. Die volle Stichprobe folgt nach den gezielten Korrekturen.

Der veröffentlichte Implementierungsstand
`b0f15875704e47c8dde6af067b9848d895db6638` hat die
[GitHub-Gesamtprüfung `Candidate · exact-SHA aggregate`](https://github.com/ThonkTank/Salt-Marcher/actions/runs/42519099321)
vollständig bestanden: alle aktiven Prüfungen einschließlich Rust-, Browser- und
P0-Tests sowie Bau und Paketmetadatenprüfung des konfigurierten Tauri-/V7-RPM.
Der damalige Dokumentationsabschluss `ecbad25` aktualisierte ausschließlich
diesen Prüfstand. Die jetzige Planrevision verändert ebenfalls keinen Produktcode,
keine Prüfprogramme und keine Lockdatei; sie ist kein neuer Laufzeitnachweis.

V7-Vergleich, RPM-Installation und echte OS-Dateidialogbedienung bleiben offen.
Die grüne Repository-Prüfung ersetzt die fehlende native P0-Leistungsabnahme
nicht. PR #1469 bleibt ein Draft. Der vollständige Ausbau P1–P9 folgt erst auf das
im bestehenden Plan festgelegte P0-Gate.
