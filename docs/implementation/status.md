# Aktueller Stand

Stand: 8. November 2026. Regulärer Produkteinstieg bleibt Atlas V7 mit
Dateiformat 22 und Generierungsrezept 4. Der optionale Electron-/Pixi-Höhenversuch
verwendet Format 24 (`atlas-p0-height-2`). [README](../../README.md) enthält
Befehle, [Architektur](../architecture.md) Zuständigkeiten und
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Ergebnis und Auftragsgrenze

Die beauftragten nächsten Schritte des [Aufräumplans](atlas-rebuild-plan.md)
sind implementiert: D11, lokale Rasterpriorität und reine Reads während des
Speicherns. Die Funktionsnachweise bestehen am gebauten Produktquellstand.
**Die Leistungsabnahme bleibt offen:** Der große warme Pinsel überschreitet in
zwei von drei kurzen Proben 50 ms; die native Referenz ist weiterhin blockiert.
Der vollständige F01–F19-Ausbau P1–P9 wartet deshalb auf das bestehende P0-Gate.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Umgesetzt und vereinfacht

- Eine aus Quellen und tatsächlich eingereichtem lokalem Terrain abgeleitete
  Freigabe steuert UI, Gestenbeginn und lesende Beobachtung. Alte Ansichten oder
  bloß geladene Daten geben keine Bearbeitung frei. Schraffur, wartender Pinsel,
  Status und Wiederholen bei Ladefehlern machen den Zustand sichtbar.
- Ein früher Druck beginnt keine Modellgeste. Halten und Bewegen lösen später
  nichts aus; Loslassen und ein neuer Druck sind erforderlich. `pressPending`,
  wartende Quellengesten und der Punktepfad sind entfernt. Der aktuelle
  Werkzeugbedarf lädt unabhängig von einer Geste. Es bleiben höchstens der
  neueste Eingabepunkt und eine noch nicht dargestellte angenommene Dosis.
- Ein Dispatcher priorisiert angenommene lokale Änderungen, lokalen Bildaufbau
  und anschließend übrige sichtbare Kacheln. Bedarfsklassen werden nicht im selben
  Batch vermischt. Nach vier konkurrierenden lokalen Batches darf höchstens eine
  Restkachel fortschreiten. Ein Worker, eine laufende Anfrage und gemeinsame
  Quellen je synchronem Batch bleiben erhalten.
- `readRegion` und `readPresentation` umgehen die Mutationsqueue während
  asynchroner Save-Phasen im selben Speicherprozess. Mutationen und
  Dateilebenszyklus bleiben geordnet. Der ungenutzte `readTiles`-Vertrag ist
  vollständig entfernt. Beide Antwortpfade teilen Session-/Sequenzprüfung und
  synchrone Übernahme; ein Ack kann benötigte Patches nicht dazwischen freigeben.
- Der Cold-Collector startet unmittelbar nach der lokalen Freigabe. Danach
  gelten dieselben Live- und 50-ms-Regeln wie beim warmen Strich. Quellen,
  Freigabe-Submit und native Bereitschaftspräsentation bleiben getrennt. Frühe
  blockierte Gesten und der tatsächlich sichtbare Hinweis zum erneuten Druck
  werden separat geprüft.

Kurze gültige Klicks, fortlaufendes Halten, stärkere langsame Züge, eine
Undo-Aktion je Strich und begrenzte Dosen bleiben erhalten. Vollständig außerhalb
des Fensters oder nach Resize wirkt eine gehaltene Geste nicht an einem falschen
Ort weiter. Datenmodell, numerische Übersichten, Dateiformat und V7-Fachfunktionen
wurden nicht ersetzt. P0 ist weiterhin kein vollständiger V7-Ersatz.

## Funktionsnachweise

| Prüfung                                                        | Ergebnis                                                                                                                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor, Modell, Renderer, Beobachtung und Auswerter            | **194 Tests bestanden**, beide TypeScript-Prüfungen bestanden                                                                                                                                             |
| SQLite-/Utility-Dispatcher und Skalierungsfixtures in Electron | **15 Tests bestanden**; beide Reads vor Snapshotende, geordneter Write danach, Export exakt S und Reopen erhalten                                                                                         |
| Regulärer Start ohne Diagnose                                  | **14 Checks bestanden**: echte Pixel, Zahlentwürfe, Undo/Redo, Speichern und Öffnen; keine Diagnoseanbindung und keine Fehler                                                                             |
| Navigation und Coastworkflow                                   | **16 Checks und fünf Fehlerkontrollen bestanden**, einschließlich Halten, langsamer Bewegung und Dateineustart                                                                                            |
| 32 / 1.024 / 9.000 echte Quellen                               | **Alle drei Rundläufe bestanden**, einschließlich grober Bearbeitung, geschützter Feindaten, Detailrückkehr, History, Save und Neustart                                                                   |
| Echter 500-ms-Renderer-Hänger                                  | **26 Checks in zwei Fällen bestanden**: bei Loslassen 0 ms des Hängers als Dosis; beim Weiterhalten 48,5 ms angenommen und 451,5 ms verworfen; keine Nachholdosis, ein Undo stellt den Ausgang wieder her |

Das Repository-Gate `Candidate · exact-SHA aggregate` wird am veröffentlichten
PR-Head geprüft; maßgeblich sind dessen [Checks](https://github.com/ThonkTank/Salt-Marcher/pull/1469/checks).
Die lokale Umgebung besitzt kein `cargo`; Rust-/Vertragsgenerator-/RPM-Prüfungen
werden deshalb durch dieses Gate belegt. Der frühere grüne CI-Lauf auf `b0f1587`
wird nicht als Freigabe des neuen Produktstands verwendet.

## Gemessene Richtung und verbleibender Fehler

Die folgende kurze Collection lief mit Electron 44.10.2, 1.440 × 960, DPR 1 und
ANGLE/SwiftShader. Es sind **Submission-Proxies einzelner kurzer Gesten**, keine
native Präsentationsabnahme und keine belastbare allgemeine p95-Verteilung.

| Fall                                          | Gemessene Zeiten und Ergebnis                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kleiner warmer Pinsel, drei Proben            | Edit→Submit p95 **42,8 / 29,6 / 29,8 ms**; Inhalt, Live-Verlauf und Undo bestehen                                                                           |
| Großer warmer Pinsel, drei Proben             | Edit→Submit p95 **54,3 / 68,7 / 50,0 ms**; Inhalt und Undo bestehen, zweimal Zeitfehler                                                                     |
| Grob über fein / warme Bearbeitung unter Last | Je ein Fall mit **47,7 / 33,9 ms** Edit→Submit p95; Inhalt, Live-Verlauf und Undo bestehen                                                                  |
| Kalter Ort                                    | Quellen **21,6 ms**, lokale Freigabe **49,9 ms** nach Navigation; erster freigegebener Edit **40,8 ms**, Navigation→erste geänderte Submission **99,1 ms**  |
| Kalter Ort während Save                       | Quellen **19,0 ms**, lokale Freigabe **53,7 ms** nach Navigation; erster freigegebener Edit **47,6 ms**, Navigation→erste geänderte Submission **104,8 ms** |

Im kalten Lastfall antworten die Quellen während des tatsächlich noch laufenden
Snapshots; auch der Edit überlappt ihn. Die frühere Probe wartete ungefähr
509 ms allein bis zu den Quellen und 690,5 ms bis zur ersten geänderten Submission.
Die damalige Datenbereitschaft ist ausdrücklich nicht dieselbe Freigabe wie D11.
Die neue Collection bleibt insgesamt **FAIL**: Nach den beiden großen Zeitfehlern
wurden die jeweiligen Gruppen abgebrochen. **10 von 18 Fällen** wurden ausgeführt;
acht fehlen. Die späteren kalten Ergebnisse machen diese Ausfälle nicht grün.

Ein zusätzlicher Versuch, fertige Ergebnisse unmittelbar beim Worker-Eingang zu
veröffentlichen, wurde [zurückgenommen](https://github.com/ThonkTank/Salt-Marcher/commit/ad63fea7c8698f2b68d77b2ca0f13e48493419d5).
Er verkürzte diesen Teil der Wartezeit, belegte aber keine verlässliche
Gesamtverbesserung: 52,2 ms bei Up und ein unveränderter letzter kleiner
Strichabschnitt blieben in seiner Probe. Der Controller war dabei unverändert;
eine neue D11-Ursache ist nicht nachgewiesen. Die einfachere RAF-Veröffentlichung
bleibt bestehen. Die verworfene Variante ist keine neue Ausgangsbasis und ihre
Berichte ersetzen keinen Nachweis des beibehaltenen Produktstands.

## Identität, Belege und nächste Übergabe

Der abschließend gebaute Produktcommit ist
[`ad63fea`](https://github.com/ThonkTank/Salt-Marcher/commit/ad63fea7c8698f2b68d77b2ca0f13e48493419d5).
Sein Produktquellhash ist
`44852ffb3f5f4143bc937e12c8cc802ae288ca783018b78285f838e17faf9a1c`.
Die Collection lief aus sauberem lokalem `bf83faa` mit exakt demselben
Produktquellhash; ihr Harness enthält bereits die Prüfung des sichtbaren
Loslasshinweises. Abschließende Interaktions-, Skalierungs-, Normalstart- und
Hängerläufe verwenden den tatsächlich ausgeführten Build von `ad63fea`.
Der abschließende Dokumentationscommit ändert weder Produkt noch Harness.

Rohbelege liegen unter `artifacts/atlas-rebuild/`: `d11-collection/`,
`d11-final-interactions/`, `d11-final-scaling/`, `d11-final-normal/`,
`d11-final-stall/` und `d11-native-preflight/`. Die verworfene Variante steht unter
`d11-publish-collection/` und den weiteren `d11-publish-*/`-Pfaden; ihr
Produktquellhash beginnt mit `1b593154`. Checklogs liegen unter
`src-tauri/target/diagnostics/d11-checks/`. Historische Rohberichte bleiben
unverändert; der [vorherige Prüfstand](https://github.com/ThonkTank/Salt-Marcher/blob/0c56dcc27676f1dcc749604d61e903747e8b7ffe/docs/implementation/status.md)
ist weiterhin nachvollziehbar.

Die native Vorprüfung endet vor Fixtureerzeugung mit Exit 2 und
`NO_NATIVE_DISPLAY`. Qualifizierte Referenz, echte Präsentationszuordnung und
vollständige native Stichprobe fehlen. P0 bleibt offen; P1–P9 werden nicht
vorzeitig als erledigt markiert. Für den verbleibenden großen warmen Fall müssen
vor weiteren Eingriffen die noch zusammengefassten Wartezeiten zwischen Dispatch,
Worker und Main-Thread-Antwort getrennt werden. Der untersuchte Gridaufbau war
nicht dominant. Keine zusätzliche Cachehierarchie, weitere Worker oder niedrigere
Zeitgrenzen sind durch die bisherigen Befunde gerechtfertigt.
