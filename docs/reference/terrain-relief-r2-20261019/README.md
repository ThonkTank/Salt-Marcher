# R2 — Höhenbearbeitung in der Atlas-Draufsicht

Lokaler Arbeitsstand vom 19.10.2026. Diese Etappe ergänzt den R1-Höhenkern im Electron-Atlas. Auf ausdrückliche Nutzeranweisung wird ohne weitere Abnahmepausen gearbeitet. Das ist keine Behauptung einer Nutzerabnahme, Installation oder Integration auf `main`.

## Vertrag und Zielabgleich

| R2-Ziel | Umsetzung und Prüfung |
| --- | --- |
| Anheben und Absenken | Eigene Gruppe **Höhen**, Stärke in m/s; zeitliche Integration entlang der vollständigen Geste. Wenige/viele Eingabeereignisse liefern denselben Verlauf innerhalb der geprüften Toleranz. |
| Zielhöhe | Metrischer Zielwert, Annäherung mit begrenzter Geschwindigkeit, kein Überschwingen. Die zentrale Hochfläche erreicht den Zielwert exakt. |
| Glätten | Symmetrische Nachbarschaft aus dem unveränderten Ausgangsfeld. Ebenen bleiben erhalten, Spitzen werden reduziert; kein Einfluss der Kachelreihenfolge. Eine gehaltene Geste glättet gegen diese Ausgangsnachbarschaft; weitere Gesten können weiter glätten. |
| Radius, Stärke, weicher Rand | Radius in Weltmaßen über die gemeinsame Einheitenanzeige, Stärke ausdrücklich in m/s, weicher Rand von 0 bis 100 %. Zielhöhe nutzt ebenfalls die gemeinsame Einheitenanzeige. |
| Geschützte Feindetails | Alle vier Werkzeuge respektieren ausdrücklich feinere Höhen. Größere Pinsel ändern diese Details nicht; Rücksetzen bleibt der ausdrückliche Weg zur Freigabe. |
| Küstenvorschau | Browserworker und Main verwenden `applyTerrainBrush`; die Vorschau zeigt bereits abgeleitetes Wasser und Relief. Der Höhenwert während der Geste ist als Vorschau bezeichnet. |
| Schattierung und Höhenlinien | Grundschattierung aus dem gemeinsamen Höhenfeld, Licht aus Nordwesten; flaches Land behält seinen Grundton. Höhenlinien optional in metrischen Abständen. Wasser wird nicht als Hang schattiert. Sehr dicht zusammenfallende Linien werden zur Vermeidung von Flimmern ausgelassen. |
| Höhe am Cursor | Begrenzte Punktabfrage im Ruhezustand, tatsächlicher Vorschauwert während der Geste. Keine Änderung des Autorenfelds durch Anzeigen oder Einheitenwechsel. |
| History, Abbruch, Schreibfehler | Eine Geste ist ein kanonischer Atlasauftrag. Escape schreibt nichts; eine fehlgeschlagene Transaktion behält Feld und Entwurf. Wiederholung erfolgt ausdrücklich über „Zug abschließen“. |
| Speichern und Bildausgabe | Vorhandene SQLite-/History-/Preload-Grenze; Bildexport übernimmt dieselbe Relief-/Höhenlinienwahl über den Bereichsreader. Keine zusätzliche schreibbare Landmaske. |

Höhenlinien sind eine Ansichtseinstellung dieser Sitzung, keine Geländeeigenschaft. Es entsteht weder Schnee noch eine andere Geländeart allein durch die Höhe. R2 liefert eine Grundschattierung; der ausgearbeitete gezeichnete Stil mit Graten und Felsstrichen bleibt R4.

## Prüfwege

- `tests/terrain-brush.test.mjs`: Pinselwirkung, Ereignisdichte, Glätten, Feinschutz, Vorschau/Gespeichert-Gleichheit, echte SQLite-Fehler und History, Neustart, Kachelnähte, optionale Höhenlinien, getrennte Darstellungs-Caches und unveränderte Quellkennung bei Lesezugriffen.
- `tests/terrain-height.test.mjs` und `tests/desktop-land-color-separation.test.mjs`: bestehender Höhen-/Wasser-/Farbvertrag.
- `tests/desktop-atlas-tool-hierarchy.test.mjs`: alle Höhenwerkzeuge erreichbar und eindeutig, bestehende Werkzeugwechsel erhalten.
- Weitere betroffene Proben: Küsten, Landwerkzeuge, Atlasregionen und gemeinsame Maße. `tests/desktop-atlas-travel-context.test.mjs` prüft zusätzlich, dass eine geänderte Höhenlinienwahl einen neuen Bereichsframe erfordert und bestehende Reise-/Kamerawechsel erhalten bleiben.
- `tools/test-desktop-terrain-brush.mjs`: reale Electron-Eingaben in einer isolierten Testkampagne; Hügel, Hochfläche, Tal, Glätten, Undo/Redo, Escape, Fehler/Entwurf/Wiederholung, Höhenlinien, PNG und frischer Prozess. Nur der Dateidialog wird auf den Test-Ausgabepfad gelenkt. Die Fehlerprobe installiert ausschließlich in dieser Wegwerfdatenbank einen auslösenden Trigger; nach Schemaänderungen wird die Ansicht neu geladen, damit die normale Quellschutzprüfung nicht mit der Schreibfehlerprüfung verwechselt wird.

## Prüfstatus

- Neue Modell-/Speicher-/Rasterprüfungen: **7/7 bestanden**.
- Bestehende Höhen-/Farbprüfungen: **18/18 bestanden**.
- Betroffene Werkzeug-/Küsten-/Regionen-/Land-/Maßprüfungen: **36/36 bestanden**. Der separate abschließende Hierarchielauf enthält acht dieser Fälle.
- Reise-/Kamera-/Frame-Kontext: **16/16 bestanden**. Zusammen **77 unterschiedliche automatisierte Fälle**; Wiederholungsläufe nicht doppelt gezählt.
- `npm run check`, `npm run check:desktop`, `npm run check:repo` und `npm run build:desktop`: bestanden. Die native Schlussprobe bindet Quellen und tatsächlich gestartete Bundles per SHA-256.
- Native Schlussprobe: **8/8 Schritte bestanden**, keine Rendererfehler, regulärer Prozessabschluss. **30 Quell-/Bundlehashes nach dem Lauf erneut verglichen**. [Ergebnis](result.json), [Prüfübersicht](verification.json), [PNG der Region](region.png), [native Draufsicht](02-relief-contours.png). Die rote Speicherwarnung wird nach bestätigter Wiederholung gelöscht; nach Abschluss/Abbruch ersetzt die tatsächliche Höhe den Vorschauwert.

Zwei Vorläufe sind keine abgeschlossenen nativen Nachweise: Zunächst traf der absichtlich angelegte Fehlertrigger die Quellschutzprüfung, weil die Ansicht noch vor der Schemaänderung geladen war. Ein weiterer Lauf überschritt während paralleler Hostprüfungen das 30-Sekunden-Limit beim Warten auf die gespeicherte Kartenansicht. Der folgende vollständige Lauf bestand und maß für zwei gehaltene Gesten rund 2,4–2,6 Sekunden vom Loslassen bis zum geladenen Stand. Das ist keine Prüfung des R7-Ziels von 100 ms für laufende Pinselrückmeldung. Die visuelle Nachkontrolle dieses Laufs fand eine verbliebene rote Speicherwarnung nach erfolgreicher Wiederholung; deren Korrektur ist im Schlusslauf bestätigt.

Visuelle Beurteilung: Hügel, ebene Hochfläche, abgesenktes Tal/Wasser und Höhenlinien sind in Draufsicht und PNG erkennbar. Die Probe verwendet absichtlich einfache geometrische Formen. Eine natürlich verzweigte Gebirgskette oder die fertige gezeichnete Ästhetik wird damit nicht abgenommen. Keine Abnahme durch bloße Testdateiverknüpfung behauptet.

## Verbleibende Roadmap

R3: editierbare Gebirgskämme, Täler, Pässe, Plateaus und Höhenkartenimport. R4: endgültige Reliefästhetik. R5: gekippte Ansicht. R6: Objekt-/Verlaufbindung und Höheninformationen. R7: vollständige Ausgabe- und Großbestandsqualifikation. Die Ziele 16 GiB, 30 FPS und 100 ms sind weiterhin unqualifiziert.

**R2 vollständig gegen die oben genannten Phasenkriterien geprüft.** R3 wird ohne zusätzliche Nutzerabnahme fortgesetzt; keine R3-Arbeit in diesem Durchlauf. Main-/Candidate-CI, Paketierung und Installation stehen aus.
