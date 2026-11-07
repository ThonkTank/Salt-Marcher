# Aktueller Stand

Atlas V7, Dateiformat 22, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Geprüfter Produktstand

Landschaftsdeckung für Wald, Buschland, Wiese und Felsgebiet funktioniert auf
allen Außenmaßstäben mit Zieldichte, Lichtungen, grober Vererbung und History.
Boden-/Felsfarbe bleibt unabhängig. Fern erscheinen Flächenfarben, mittlerer Wald
als durchgehendes Blätterdach mit dichteabhängigen Lücken, nahe Bäume als eigene
Federzeichnungen mit unregelmäßigen Kronen und Schraffur. Große Viewports behalten
das Blätterdach, bis Einzelbäume in das gemeinsame Kandidatenbudget passen.
Mittlere Darstellung, 25/65/100-Prozent-Deckung und große Zoomübergänge wurden an
Browserbildern visuell geprüft. Rasterhalos und Geräte-Pixel-Clips sichern Nähte.

Leere Boden-/Landschaftskacheln übertragen keine Pixelnutzlast und erzeugen keine
Zeichenraster. Unsichtbare Boden-, Landschafts-, Gelände- und Stadtdichtekacheln
überspringen ihre teure Verarbeitung. Kleine ebene Ausschnitte grober Höhenautoren
werden durch höchstens vier vollständige konstante Spline-Abschnitte erkannt;
fehlende Stützwerte bleiben konservativ. Der vollständige Rusttestlauf auf diesem
Sampler-Fix besteht, ebenso 27 Landschafts-/Live-Höhen-Browserfälle einschließlich
des zuvor gescheiterten 4K-Ladefalls, ohne verlängerte Zeitlimits.

Der Außengeometriecache behält weiterhin benötigte Konturen innerhalb unveränderter
256 Einträge und 16 MiB. Basis, Auswahl und Vorschau teilen den Abgleich; entfallene
Referenzen geben Platz frei. Die temporäre Schlüsselmenge ist ebenfalls begrenzt.
Ein reproduzierter Fall mit drei Objekten und zwei Plätzen baut jetzt pro weiterem
Bild eine statt drei Konturen neu. Sieben Geometrietests und 18 Stadt-/Straßen-/
Parzellen-Browserfälle bestehen. Daraus wird keine Latenzverbesserung abgeleitet.

Der Flusspfadcache verwendet jetzt denselben begrenzten Abgleich und dieselbe
Aufnahme ohne Verdrängung aus `BudgetCache`. Die entsprechende eigene
Kostenverwaltung des Außengeometriecaches entfällt. Ein reproduzierter Bestand
von 257 Flüssen bei 256 Plätzen baute zuvor 257 Pfade je weiterem Bild neu;
jetzt entsteht nur ein neuer Pfad. Ausschnitts-/Objektwechsel bleiben invalidierend.
Beim Zoomen bleiben Konturen erhalten, solange die Mindestbreite von 1,5
Bildschirmpixeln an keinem Sample eingreift. Der Regressionstest scheiterte vorher
an einem unnötigen Neuaufbau; er prüft jetzt Wiederverwendung sowie korrekte
Konturkoordinaten beim Heraus- und erneuten Hineinzoomen. Alle 429 Frontendtests, Typen, Format sowie zehn Fluss-
Browserfälle bestehen, einschließlich Vorschauabbruch, Navigation, Topologie,
History und Sessionwechsel. Der frische Release-/RPM-Build besteht. Die Änderung
liegt als Folgebranch hinter dem integrierten Main-Kandidaten; eine native
Bedienprüfung und eine neue Latenzaussage sind damit nicht belegt.

Die Walddichte zeigt nach einer Prozenteingabe keine binären Rundungsreste mehr.
Die Browserprobe reproduzierte zuvor `55.00000000000001` nach Eingabe von `55`.
Nach der reinen Anzeigeänderung bleiben 55, 55,5, 55,12345 sowie die Grenzen
5 und 100 lesbar und unverändert. Typen, Format und frischer Release-/RPM-Build
bestehen; Autorenberechnung
und Eingabegrenzen wurden nicht geändert.

## Zahleneingabe vor dem ersten Kartenklick

Eine Browserprobe reproduzierte nach Eingabe von 2 Fuß Flussbreite die gespeicherten
Knotenbreiten `[20, 2]`: Der erste Pointerdown las vor dem Feld-Blur den alten Wert.
Zeichenwerkzeuge übernehmen fokussierte Zahlenfelder jetzt vor ihrem Snapshot.
Der Auswahlmodus behält die Reihenfolge für Inspector-Writes und Auswahlabsichten.
Der Regressionstest scheiterte vorher; danach speichern beide Knoten 2 Fuß.
Die erneute Browserprobe einschließlich Heraus-/Hineinzoomen bestätigt die
schmale Kontur. Alle 22 Fluss-, Datei- und Fokuswechseltests bestehen, einschließlich
Umbenennen mit anschließender Haus-/Raumauswahl; 429 Frontendtests und Typen bestehen.
Der frische Release-/RPM-Build besteht ebenfalls (7,52 MiB).

## Höhenstrich während eines Ansichtswechsels

Eine schrittweise Browserprobe mit echtem Dokumentkern zeigte: Weltmalen nach
freiem Herauszoomen liefert sichtbare Zwischenstände und vollständiges Undo/Redo.
Ein unmittelbar während des Ansichtswechsels begonnener Strich wurde dagegen
wegen der Darstellungssperre als Verschieben behandelt. Der neue Browsertest
reproduzierte null gestartete Höhenstriche bei zurückgehaltener Weltansicht.

Die Eingabefreigabe verwendet für Außenhöhen jetzt den bereiten Dokumentstatus.
Der Worker liest die Autorenwerte; aktuelle Kamera und Pinsel bestimmen den
Auftrag. Fehlender Status, Dateiaktionen, unsicherer Status und ausstehende Writes
sperren weiterhin den Start. Szenenabhängige Werkzeuge behalten ihre Datensperre.
Alle 421 Frontendtests, Typprüfung und Formatprüfung bestehen. Alle 29 Höhen-/
Navigations-Browserfälle bestehen einschließlich des neuen Tests, unveränderter
Kamera, History, Weltzoom, runder/kräuseliger Küsten, Fehlererholung und Abbruch.
Der frische Release-/RPM-Build besteht ebenfalls (7,52 MiB).

Die Übersicht behandelt auch bei gesperrten Malwerkzeugen linkes Ziehen nicht
mehr als Kartenverschiebung. Fünf Regressionen reproduzierten zuvor dieses
Fehlverhalten; sie prüfen nun alle Malwerkzeuge sowie weiterhin verfügbare
Navigation per mittlerer Taste und Leertaste. Alle 426 Frontendtests und Typen
bestehen. Vier Browserfälle prüfen ausstehende Begin-/Append-Antworten,
Zeichnen während des Ladens sowie einen zweiten Strich während des Abschlusses.
Der Beginn eines neuen Strichs während ausstehender Writes bleibt gesperrt.
Der erneute Release-/RPM-Build besteht; native Bedienung bleibt offen.

## Integration und offene Abnahmen

Main enthält Landschaft, Darstellungsbegrenzung, Sampler-Fix sowie die drei
Folgekorrekturen für Außengeometrie und Höhenbeginn während Ansichtsreads.
PR #1460 ist als `707953e17` integriert; der Main-Baum entspricht exakt dem
geprüften Kandidaten `c4baf9ecf`. Die vollständige CI besteht: 337 Rust-Librarytests,
32 Integration-/Adaptertests, fünf absichtlich ignorierte Fälle, 245 Browserfälle,
Frontendtests, Typen, Transportverträge, Clippy, Format und Release-/RPM-Build.
Die ersetzten Vorstufen #1458 und #1459 sind geschlossen.

Der nächste Kandidat umfasst Flusscache, Zoomwiederverwendung, Dichteanzeige und
die Korrektur der Zahleneingabe vor dem ersten Kartenklick. Seine vollständige
Main-CI steht noch aus; lokale Ergebnisse ersetzen diese Freigabe nicht.

Frühere native Prüfungen umfassen Weltmalen, Bodenfarben, Landschaft, Navigation,
Lichtungen, History und Datei-Rundlauf. Die neueren Zeichnungen und Änderungen
sind noch nicht nativ bedient: Diese Sitzung bietet keinen nativen UI-Zugriff.
Das ursprüngliche Benutzertestfenster bleibt unberührt. Ein frischer Releasebuild
ersetzt diese Abnahme nicht.

Genau eine frühere Vorher-/Nachher-Reihe mit je drei Weltstrichen ist abgeschlossen:
erste sichtbare Änderung 275–304 → 119–134 ms, sichtbare Bestätigung p95
427–516 → 339–376 ms, Nachlauf 259–427 → 231–345 ms. Spätere Änderungen sind darin
nicht enthalten. Das Ziel p95 ≤50 ms bleibt unbelegt; keine weitere Zeitmessreihe.
RPM-Installation, große Stadt-/Weltlastfälle und umfangreicher Release-Treiber
bleiben offen. Einzelobjektplatzierung, lokale Verschiebeausnahmen, Feldumrisse
und Assetimporte bleiben Folgeumfang der Landschaftsdeckung.

Belege unter `src-tauri/target/diagnostics/`: `landscape-canopy/`,
`landscape-capacity/`, `compact-empty-ground/`, `terrain-visibility/`,
`city-density-visibility/`, `coarse-flat-proof/`, `landscape-main-integration/`,
`stable-exterior-geometry/`, `terrain-view-load/`, `blocked-brush-navigation/`
und `stable-river-geometry/`.
