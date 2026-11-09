# Aktueller Stand

Stand: 9. November 2026. Atlas V7 bleibt der reguläre Produkteinstieg mit
Dateiformat 22; der optionale Electron-/Pixi-Höheneditor verwendet Format 24.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten und [Produktvertrag](../product-contract.md) Verhalten und Grenzen.
[PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469) bleibt Draft.

## Ergebnis und Auftragsgrenze

Die Korrektur von Eingabeannahme, Zeitrechnung und Framefolge ist umgesetzt und
fachlich verifiziert. Bereite Bewegungen werden vor einem unmittelbar folgenden
Pointerup angenommen. Haltedosen entstehen vor ihrem Draw; nach dem Draw entsteht
keine weitere Dosis. Die zusätzliche Framewartezeit eines bereits fertig
projizierten Pinselstands ist im gemessenen Langzug beseitigt.

**Der große Pinsel bleibt insgesamt FAIL.** Alle drei kurzen 512-Pixel-Proben
bestehen jetzt Inhalt, Endpunkt und Undo; eine besteht zusätzlich ihre lokalen
Live-/Zeitkriterien. Zwei scheitern weiterhin an Livefortschritt beziehungsweise
Abschlusslatenz. Der lange Verlauf verfehlt weiterhin Kontinuität und Pointerup-
Latenz. Die native Abnahme bleibt zusätzlich blockiert. P0 ist nicht freigegeben;
P1/P2/P3 und der vollständige F01–F19-Umfang behalten ihr bestehendes Gate.

## Implementierter Stand

- `EditorDocument` bleibt die einzige Float64-Autorität. Numerischer GPU-Atlas,
  High-/Low-Rekonstruktion, 22 mögliche Stufen, Übersicht, 4-MiB-Uploadbudget und
  beibehaltene Farbkacheln bleiben erhalten. Der gewöhnliche CPU-Rasterworker ist
  weiterhin entfernt; der numerische Ausnahmefallback bleibt unverändert.
- Down nimmt seinen kleinen Anfangsimpuls sofort an. Move verwendet dieselbe
  Dosisentscheidung unmittelbar auf der zuletzt tatsächlich gezeichneten lokalen
  Grundlage. Der RAF nimmt höchstens eine bereite Dosis an und zeichnet sie im
  selben Callback. Höchstens eine eigene Dosis darf auf Darstellung warten.
- Bewegung und Halten besitzen weiterhin genau ein Zeitkonto. Zusätzliche
  Mausereignisse während einer normalen ausstehenden Darstellung setzen es nicht
  zurück. Erst eine erfolglose Zeichenrunde verwirft Wartezeit und nicht angewandten
  Weg; diese Nach-Draw-Phase kann selbst keine Dosis erzeugen.
- Die 50-ms-Begrenzung, das Verwerfen alter Wege bei Hängern und die Freigabe für
  Quellen und tatsächlich gezeichnetes Terrain bleiben wirksam. Loslassen oder
  Abbruch erzeugen keine weitere Wirkung. Bereits angenommene Änderungen bleiben
  ein gemeinsamer Undo-Schritt und verwenden denselben Speicherpfad.
- Eine während ausstehendem Feedback noch nicht angenommene letzte Bewegung wird
  bei Up weiterhin verworfen. Die gewöhnlichen Prüffälle müssen schnell genug
  laufen, damit dieser Schutz dort nicht zum Ersatz für funktionierende Eingabe
  wird. Auswerter, 24-ms-Eingabefolge, 512-Pixel-Größe und Zeitgrenzen sind unverändert.

## Verifikation am Produktquellstand

| Prüfung                                              | Ergebnis                                                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editor-/Modell-/Controller-/Renderer-/Auswertertests | **326 Tests in zwölf Dateien bestanden**, darunter 65 Renderer-/Controllerfälle.                                                                                                                                   |
| Aussagekraft der neuen Regressionen                  | Drei gezielte Fälle scheitern gegen den alten Stand `68c55e0`: bereites Move/Up mit 16 und 512 Pixeln verliert den Endpunkt; Halten zeichnet eine ältere Revision. Dieselben Fälle bestehen mit der Korrektur.     |
| Gemeinsame Zeitrechnung                              | Gleicher Weg und gleiche Dauer bei 30/60/120-Hz-Eingaben und 60-Hz-Rendering behalten dieselbe angenommene Zeit und vergleichbare Terrainwirkung. Halten, langsamer/stärker und Stall ohne alten Restweg bestehen. |
| TypeScript und Format                                | Allgemeine Typprüfung, Tool-Typen, betroffene Formatprüfung und `git diff --check` bestanden.                                                                                                                      |
| `npm run check:atlas-p0`                             | Sauberer Build; **15** echte Electron-/SQLite-/Fixturetests, **83** Desktop-/Hänger-/Lifecyclechecks und **fünf** GPU-Pixelreferenzfälle bestanden.                                                                |
| Reale Interaktionen                                  | **18 von 19** Funktionsprüfungen bestanden. Nur der lange Großpinsel scheitert am Zeit-/Kontinuitätsvertrag; Inhalt, History, Dosis, Stall und fein/grob/fein bestehen.                                            |
| Fehler-/Erholungskontrollen                          | **Alle fünf bestanden**, einschließlich der ungestörten abschließenden Erholung.                                                                                                                                   |
| Native Vorprüfung                                    | **BLOCKED / Exit 2**, ohne Fixtures oder Programmstart.                                                                                                                                                            |

Die GPU-Referenz enthält tatsächliche Pixel, Farb-/Kachelgrenzen, alle 22 Stufen,
gewöhnliche große Auslöschung, Weltrand, extreme endliche Auslöschung und
Kontextverlust mit Wiederherstellung. Der Daten-, Store- und Übersichtspfad wurde
nicht verändert; die frühere separate Skalierungsserie 32/1.024/9.000 wurde in
diesem Eingabeschnitt nicht als neuer Nachweis wiederholt.

## Unveränderte kurze Großpinsel-Proben

Drei unabhängige Starts, jeweils vier Positionen mit 24-ms-Abständen und
512 Pixel Durchmesser. Electron 44.10.2, 1.440 × 960, DPR 1,
ANGLE/Vulkan mit SwiftShader. Alle Ergebnisse bleiben erhalten.

| Probe | Down → Submit | Größter angenommener Edit → Submit | Up → Submit | Aktuelle Eingabeframes vor Release | Inhalt, Endpunkt, Undo | Ergebnis                               |
| ----- | ------------: | ---------------------------------: | ----------: | ---------------------------------: | ---------------------- | -------------------------------------- |
| 1     |       12,8 ms |                            24,7 ms |      5,2 ms |                                  1 | Bestanden              | FAIL: Live-Mindestkontrolle            |
| 2     |       15,0 ms |                            25,7 ms |      6,2 ms |                                  2 | Bestanden              | PROXY_ONLY: lokale Kriterien bestanden |
| 3     |       16,2 ms |                            21,6 ms |     80,0 ms |                                  3 | Bestanden              | FAIL: Abschlusslatenz                  |

Alle drei D10-Zeitbilanzen bestehen. In Probe 1 erreichen zwei frühere Bewegungen
den Handler erst nach 59,3 beziehungsweise 35,3 ms und werden zusammengefasst;
der letzte angenommene Move wird 0,4 ms nach dem physischen Release eingereicht.
In Probe 3 war die letzte Terraindosis schon vor dem Up-Handler gezeichnet.
Die anschließende Bestätigung wartet trotzdem auf den nächsten Frame; dieser
überträgt null Bytes und verändert keine Terrainkachel.

## Langer Strich und beseitigte Zusatzwartezeit

Der ungestörte Langzug behält 101 Positionen und 24-ms-Abstände. Seine 33
angenommenen Edit-Eingaben erreichen **20,3 ms Median, 36,2 ms p95 und 37,3 ms
Maximum** bis zur Zeicheneinreichung. Der separate Up-Beleg benötigt **136,8 ms**;
die längste bewertete Bewegungspause beträgt **191,0 ms**. 33 aktuelle
Eingabeframes liegen vor Release, 68 Eingaben werden zusammengefasst. Inhalt,
History und Zeitbilanz bestehen; der Gesamtfall bleibt FAIL.

Im vorherigen einzelnen Lauf desselben Szenarios lagen die angenommenen Edits
bei 80,8 ms Median und 109,1 ms p95. Die Wartezeit vom fertig projizierten Stand
bis zum Upload sinkt im Vergleich dieser beiden Proben von **59,1 auf 0,9 ms
Median**. Die verbleibenden Pausen werden dadurch nicht zum Erfolg: vorher waren
es 36 aktuelle Eingabeframes, 133,4 ms maximale Bewegungspause und 10,2 ms für Up.
Das ist ein Vergleich einzelner SwiftShader-Läufe, keine allgemeine
Beschleunigungs- oder Regressionsaussage für qualifizierte Hardware. Die
Modellarbeit findet jetzt meist im Inputhandler statt; die geringere CPU-Zeit
innerhalb des RAF ist deshalb kein Nachweis eingesparter Modellberechnung.

Der getrennte Inhaltslauf zeigt frühe, mittlere und späte Terrainänderungen
während derselben Geste. Ein tatsächlicher 200-ms-Hänger verwirft 150,6 ms seiner
Zeit; keine Folgedosis überschreitet 50 ms oder malt einen alten gedeckelten Weg.
Undo/Redo und die vorhandene Stufenfolge bestehen.

## Verbleibender Grafik-/Swap-Rückstau

Eine zusätzliche einzelne Chromium-Aufzeichnung verwendet dieselbe lange
Eingabefolge in einem frischen Prozess. Sie ist ausdrücklich Diagnose, enthält
keine Screenshotaufnahmen im Zeitlauf und ersetzt keine Abnahme.

Der GPU-Prozess verbringt in 38 `SkiaOutputSurfaceImplOnGpu::SwapBuffers`-Spannen
**70,5 ms Median, 92,4 ms p95 und 94,1 ms Maximum**. Die eigene erfasste CPU-Zeit
dieses Threads beträgt dabei nur 1,6 ms Median. 47 ausdrückliche
`Swap throttled`-Ereignisse melden eine ausstehende bei höchstens einer erlaubten
Bildausgabe. Rund 96 % der Lücken zwischen den Framecallbacks überlappen diese
Swap-Spannen. Der längste erfasste Renderer-Mainthread-Task beträgt 21,8 ms.

Damit ist die lange inklusive Wartephase im Software-Grafikausgabe-/Swap-Pfad
eingegrenzt. Die Messung isoliert weder die Shaderkosten noch die Ursache
innerhalb von SwiftShader/Vulkan/Swap-Warten. Sie beweist keine gleichlange
Berechnung auf einer echten GPU. Ein weiterer Umbau des Autorenmodells oder ein
zusätzliches Cache-System ist durch diesen Befund nicht begründet.

Der nächste technische Nachweis betrifft genau diesen Rückstau und die
Abschlussbestätigung, mit einer echten GPU als Vergleich. In dieser Umgebung
fehlen Display und Hardware-GPU-Gerät. Die native Vorprüfung nennt weiterhin
`NO_NATIVE_DISPLAY` und `NATIVE_PRESENTATION_MAPPING_UNPROVEN`; die Zuordnung einer
exakten Terrainrevision zu ihrer ersten tatsächlichen Präsentation bleibt eine
eigene offene Abnahme. Die Laborfehler werden dadurch nicht nachträglich bestanden.

## Identität und Belegpfade

Sauberer Produktbuild: `102c5302d2668e06736ef9fb93c849b163de6626`, `dirty: false`.
Produktquellhash: `4d2b31fef795a2c1bda8dad22dbe8984c416bc7a263308ac9db6fa8ccd5a3002`.
Lockhash: `b471b4a1da63f4226f95a28b60f3345aa03e51803f0ef1982624cd16a2d35bc2`.
Die anschließende Statuspflege ändert keine Produkt- oder Prüfquellen.

- `src-tauri/target/diagnostics/brush-flow/desktop-check.log`;
- `src-tauri/target/diagnostics/atlas-gpu-reference/report.json`;
- `artifacts/atlas-rebuild/smoke-2026-11-09T06-58-49.488Z/`;
- `artifacts/atlas-rebuild/brush-flow-warm512/` und `brush-flow-interactions/`;
- `artifacts/atlas-rebuild/brush-flow-native-preflight/native-preflight.json`;
- `src-tauri/target/diagnostics/brush-flow/long-stroke-trace/`;
- temporärer Diagnose-Driver unter `src-tauri/target/cleanup/brush-flow-trace/`.

Der erforderliche Repositoryjob bleibt **Candidate · exact-SHA aggregate** für
den veröffentlichten Head; sein aktueller Zustand steht im PR. Der vorherige
Head `68c55e0` scheiterte separat im V7-Browsertest `house-lod.spec.ts` an einer
Canvas-/Viewportabweichung nach Größenänderung. Dieser Eingabeschnitt verändert
diesen unabhängigen V7-Pfad nicht. Installierte RPM-Bedienabnahme und native
Leistungsfreigabe bleiben offen. Der begrenzte Auftrag aktiviert nicht den
vollständigen Atlas-Neubau.
