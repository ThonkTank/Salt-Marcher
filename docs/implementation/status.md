# Aktueller Stand

Stand: 11. November 2026. **Die V7-artige Bedienoberfläche ist im neuen
Electron-/Pixi-Editor umgesetzt; der Fachstand bleibt P3.3.** Ausgangspunkt
ist `30f3c01606faf824551f3716c14560b5b0e4a8b4` auf
`work/atlas-p0-feasibility`. [PR #1469](https://github.com/ThonkTank/Salt-Marcher/pull/1469)
bleibt Draft. Atlas V7 bleibt der reguläre Tauri-Einstieg mit Format 22;
der optionale Editor verwendet unverändert Format 27
(`atlas-p3-derived-water-1`). Frühere P0-Dateien werden nicht migriert.

## Arbeitsentscheidung

Der ausdrücklich begrenzte Nutzerauftrag übernimmt **nur die UI**, keine
fehlenden Fachfunktionen. Er aktiviert weder P3.4 noch P4–P9 und ist keine
Freigabe offener Leistungsnachweise. Der
[Neubauplan](atlas-rebuild-plan.md) bleibt der einzige Ausführungsplan.

Die bisherige Freigabe der begrenzten R5-Fortsetzung bleibt bestehen.
Der nächste Fachschritt ist weiterhin P3.4 „Echte Fachkonkurrenz“.
Vollständige P0-Abnahme und bestandener gemeinsamer P3-Fall bleiben
Voraussetzungen für P4–P9. Die offene R4-Leistungsabnahme wird durch diesen
Oberflächenumbau nicht als bestanden gewertet.

## Oberfläche und unveränderte Grenzen

`src/editor/main.tsx` bindet weiterhin genau einen `EditorController` an
dasselbe Canvas. `EditorChrome.tsx` enthält Kopfzeile, Werkzeugleiste,
Kartennavigation und Status; `EditorPanels.tsx` enthält die vorhandenen
Werkzeug- und Oberflächenfelder. Diese Komponenten importieren keine
V7-Controller, Clients oder Fachmodelle. React hält nur Feldentwürfe;
wirksame Einstellungen und Kartenaktionen verbleiben im vorhandenen Controller.

Die bisherige linke Sammelleiste ist durch eine schmale Werkzeugleiste links,
eine feste kontextbezogene Eigenschaftenspalte rechts und die Karte dazwischen
ersetzt. Kopfzeile und Status haben reservierte Flächen. Bei kleineren Fenstern
werden die Kopfzeile zweizeilig und die Seitenleisten unabhängig scrollbar.
Werkzeugwechsel tauschen weder das Canvas noch dessen direkten Elternknoten aus.

Dateien, Undo/Redo, sieben vorhandene Werkzeugmodi, Zahlenfelder, Raster,
Ansichtsvorgaben, Koordinatennavigation, Gewässerszene, Fehler-/Recoveryanzeigen
und der bestehende Updater behalten ihre bisherigen Aktionen. Ein zusätzlicher
Maßstabsbalken ist ausschließlich eine Anzeige aus dem Kameramaßstab.
Straßen-, Fluss-, Gewässer-, Boden-, Regionen- und Innenraumwerkzeuge sowie
noch fehlende Höhen-/Gebäudeeinstellungen sind sichtbar deaktiviert.
„Einpassen“ ist ebenfalls deaktiviert; ein nicht vorhandener Befehl wird
nicht durch eine andere Kamerafunktion vorgetäuscht.

`EditorController`, Modell, Renderer, Session, IPC, Updater, Dateiformat und
V7-Startpfad wurden nicht verändert. Keine neuen Fachaktionen, keine
Kompatibilitätsschicht, keine zusätzliche Zustandsverwaltung und keine neuen
Abhängigkeiten.

## Aktueller UI-Nachweis

Der neue Prüfer `scripts/atlas-editor-ui-smoke.mjs` ist nach dem vorhandenen
normalen Produktsmoke in `scripts/check-atlas-p0-package.mjs` eingebunden.
Ein Vorschau-Paket muss damit beide Prüfungen bestehen. Der Prüfer bedient
die echte Oberfläche; Beobachtungen sind ausschließlich lesend.

**Lokal: 40/40 Prüfungen bestanden.** Geprüft wurden Dreispaltenanordnung,
deaktivierte Werkzeuge, alle vorhandenen Modusbindungen, unverändertes Canvas
und Kamera bei Werkzeugwechseln, Enter-/Blur-Übernahme mit Einheitenumrechnung,
Landschafts- und Hausfelder, Koordinaten, Raster, Mausradzoom, Verschieben,
eine tatsächliche Höhenaktion mit Undo/Redo, tatsächliches Speichern, der
Update-Dialog sowie 900×620-Fenstergröße ohne horizontal abgeschnittene
Werkzeugtexte. Screenshots wurden bei 1280×960 und 900×620 geprüft.

Eine Negativkontrolle blendete ausschließlich den rechten Inspector per CSS
aus. Der unveränderte Prüfer scheiterte an seiner ersten Layoutprüfung mit
Exit 1. Nach Entfernen dieses Fehlers bestanden erneut **40/40** Prüfungen.
TypeScript-Transpilation der geänderten TSX-Dateien, JavaScript-Syntaxprüfung
und Formatprüfung der geänderten Dateien bestanden ebenfalls.

**Beweisgrenze:** Die lokale Umgebung konnte GitHub/npm nicht direkt auflösen.
Deshalb wurden die geänderten TSX-Dateien mit dem verfügbaren TypeScript-Compiler
transpiliert und in einer isolierten Kopie des veröffentlichten Pakets von
`66f11cb5046182283569941d18bca7b93d7b3a56` mit dessen tatsächlichem React,
Controller, Pixi-Renderer und SQLite-Prozess ausgeführt. Nur UI-Einstieg und CSS
wurden ersetzt. Der lokale Start nutzte Xvfb/X11 und Softwaregrafik; der
übliche Headless-Ozone-Start erhielt hier keinen WebGL-Kontext. Diese
Umgebungsanpassung ist nicht Teil des Produktcodes. Die Formatprüfung verwendete
Prettier `3.11.0-dev`, nicht die im Repository gepinnte Installation.

Dies ist ein nativer **UI-Integrationsnachweis**, kein sauberer vollständiger
Quellbuild, keine vollständige Typprüfung und kein neu gebautes Release.
Die Buildidentität in den lokalen Berichten bezeichnet deshalb den zugrunde
liegenden veröffentlichten Kern, nicht einen vollständig neu gebauten UI-Commit.
Der exakte neue Commit benötigt weiterhin den normalen CI- und Paketlauf.
Die bestehende Produktsmoke-Suite wurde lokal nicht vollständig neu ausgeführt.
Es wird keine neue Performance- oder Hardwarequalifikation behauptet.

## Veröffentlichter Ausgangsstand

Der zuletzt in diesem Auftrag bestätigte veröffentlichte Stand ist
**0.3.2-43101913532.1**, Programmcommit
[`66f11cb5046182283569941d18bca7b93d7b3a56`](https://github.com/ThonkTank/Salt-Marcher/commit/66f11cb5046182283569941d18bca7b93d7b3a56),
Produktquellhash
`faba5c44e5b953ddb4b420b42e136b60c350fab4e96a840c322d417219accecd`.
Der [Vorschau-Lauf 43101913532](https://github.com/ThonkTank/Salt-Marcher/actions/runs/43101913532)
bestand einschließlich Veröffentlichung: Typprüfung, 35 Updaterfälle,
6 Releasefälle, 7 native Netzfälle, 2 RPM-Fälle, 95 normale Paketprüfungen
und 11 Update-Dialog-/IPC-Prüfungen. Diese Zahlen gehören zu diesem
**alten** Programmstand, nicht zum neuen UI-Umbau.

Der Kanal [atlas-preview](https://github.com/ThonkTank/Salt-Marcher/releases/tag/atlas-preview)
wird erst nach einem erfolgreichen neuen Paket-/Updaterlauf ersetzt. Der
UI-Commit allein belegt weder einen neuen Installer noch dessen Veröffentlichung.
Ältere Binärdateien bleiben für laufende Downloads erhalten. Reguläre Releases
und der V7-Einstieg bleiben getrennt.

## Offene Abnahmen und bekannte Grenzen

Die letzte vollständige Höhen-GPU-Reihe am P3.2-Stand bleibt **FAIL, 3/6**.
Der R4-Haltebefund und die native Hardware-/20-ms-Eingabe-zu-Präsentation-Abnahme
bleiben offen. Die früheren P3.3-Nachweise von `0feacd1` (947 Editortests,
29 Storefälle und 202 vollständige Paketprüfungen) sind keine erneuten
Nachweise für diesen UI-Stand.

Die tatsächliche Fedora-DNF-/Polkit-Installation über den In-App-Updater wurde
in der bisherigen Prüfumgebung nicht ausgeführt. Die manuelle Erstinstallation
von 0.3.1 wurde vom Nutzer bestätigt. Der damalige Live-Feedabruf im
Electron-Prozess scheiterte mit `net::ERR_EMPTY_RESPONSE`, während `curl`
denselben Feed lesen konnte. Unabhängige native Netzwerkaufrufe reproduzierten
den Fehler; seine Ursache bleibt offen. Kontrollierte Netzwerk-/Prozesstests
ersetzen weder diesen Live-Nachweis noch eine tatsächliche Systeminstallation.

Ein früherer lokaler Landschafts-Paketsmoke hatte einen Bereitschaftstimeout,
der auch am vorausgehenden Paket reproduzierbar war. Ein gezielter 27/27-Lauf
und der erfolgreiche veröffentlichte CI-Smoke machten diesen Fehlversuch
nicht rückwirkend erfolgreich; eine behobene Ursache ist nicht nachgewiesen.

P3.3 bleibt eine vorbereitete editierbare Gewässerszene mit bestätigten
Wasserautoren, aktuellem Geländeclip und lokalen Fundamentableitungen.
„Gewässer an Gelände anpassen“ bleibt deaktiviert; vollständige Werkzeuge
gehören weiterhin zu P7. Der UI-Umbau erweitert diesen Fachumfang nicht.
