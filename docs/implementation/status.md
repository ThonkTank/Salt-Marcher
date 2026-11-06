# Aktueller Stand

Atlas V7, Dateiformat 18, Generierungsrezept 4. Stand: 6. November 2026.
[README](../../README.md) enthält Einrichtung und Abnahme, die
[Architektur](../architecture.md) Zuständigkeiten und der
[Produktvertrag](../product-contract.md) Verhalten und Grenzen.

Raum, Haus und Grundstück bleiben äußere Nahansichten mit ausdrücklich geöffneten
Innenräumen. Die Kontexthilfe, der Weltpinsel-/Rasterhinweis, der begrenzte Cache
exakter Außengeometrie und die Wiederverwendung vollständig abgedeckter Raster
bleiben erhalten. Unsichtbare Regions-/Flussreads werden innen unterbrochen.
Exakte Szenenwiederverwendung prüft ihre Anfrageherkunft; reine Abwahl darf eine
revisionsgleiche vollständige Außenszene mit geleerten Ownerdaten wiederverwenden.

Die Grundstückänderungen bereiten Parzellen-ID-Mitgliedschaft einmal pro
Szenenvorbereitung beziehungsweise Treffertest vor und teilen die reine
Skalensperre zwischen Bearbeitungsfreigabe und Werkzeughinweis. Reihenfolge,
Objektidentität, Schwellen und Hysterese bleiben erhalten. Gesperrte Werkzeuge
fordern zum Hineinzoomen auf; Flussplanung hat einen eigenen Hinweis. Ein Zeit-
oder FPS-Gewinn ist nicht gemessen.

Das unabhängige Grundstückreview bestand mit 114 gezielten Unit-Tests und
Typprüfung; der Browserlauf bestand 14 von 17 Fällen. Der anschließende einzige
G-Durchgang korrigierte ausschließlich die Kamerabeobachtung im Browsertest:
Transformation und verfügbare Viewportfläche werden getrennt geprüft. Der
Inspector darf die Canvasbreite ändern; x/y/Skala müssen beim Auswählen und
expliziten Innenöffnen/-verlassen exakt erhalten bleiben. Das begründete
Canvasquantisierungsbudget unter 0,001 CSS-Pixel und die mathematische
Ankerprüfung auf neun Dezimalstellen bleiben bestehen.

Nach G bestand die Typprüfung; im einmaligen regulären Browserlauf bestanden
15 von 17 Fällen. Beide Haus-/Grundstück-Zoomfälle bestanden erstmals vollständig
mit Anker, Nullcommits, History und Innenöffnen/-verlassen. Zwei Erstgestenfälle
blieben rot: Auswahl→Haus im ursprünglichen Startmaßstab und erstmals auch der
zusätzliche Grundstückmaßstab-Fall erzeugten kein Objekt. Die folgenden
Commit-/Historyassertionen dieser Fälle wurden nicht erreicht. Der Kontrollwechsel
Haus→Straße→Haus bestand. Ein einzelner instrumentierter Diagnosefall bestand,
belegt aber keine Ursache der roten Abläufe; Resize und Freshness bleiben
Hypothesen. Es gab keine spekulative Produktkorrektur, Wartehilfe, zweite Geste
oder weitere Reparaturschleife. Landschaftsauswahl bestand, ihre frühere
wechselhafte Ursache bleibt ungeklärt.

Der Grundstückstand ist nicht vollständig abgenommen. Belege liegen unter
`src-tauri/target/cleanup/lod-review/lod02/F/` und `G/`. Nächster Schritt ist H
zur ehrlichen Veröffentlichung des erhaltenen Stands unter bestehenden Checks;
keine zweite G-Runde. Danach folgt der separate frische Cleanup-Abschnitt.

Eine aktuelle vollständige Browser-/CI-Freigabe fehlt. Der bekannte ältere
veröffentlichte Lauf scheiterte an sieben Browserfällen; ein späterer
Vorläuferlauf war zuletzt dokumentiert in_progress und wurde hier nicht erneut
abgefragt. Main-Veröffentlichung bleibt an echte Checks des tatsächlichen
Kandidaten gebunden. Native Bedienung, RPM-Nachweis, große Performanceprüfung
und die vollständige begonnene Phase-4-Zeichenplanung bleiben offen.
