# Aktueller Stand

Atlas V7, Dateiformat 19, Generierungsrezept 4. Stand: 7. November 2026.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktuelle Optimierung

Die ungenutzten Höhenübersichten `terrain_lod` und `terrain_layer_overview`
samt Writes und Import-Rebuild sind entfernt. `terrain_blocks` bleibt der einzige
abgeleitete Höhenindex. Land/Meer berechnet exakte Kandidaten entlang des Strichs
über einen temporären 16×16-Blockindex; lange Diagonalen verwenden ihren Korridor.
Autorenreads und Auftrag teilen diese Kandidaten. Die Queue sendet höchstens
32 neue Punkte je Append und reserviert den vollständigen Abschluss vor
History-/Dateigrenzen. Schon Begin liefert nur betroffene Oberflächenkacheln.

Konstante Relief-/Wasserraster bleiben im Frontend 1×1-Bilder; der Dekoder
vermeidet Pixel-Zwischenarrays. Reliefgradienten verwenden das vorhandene
33×33-Höhenraster und nur 280 zusätzliche Randpunkte. Die Darstellung zielt auf
kleinere Kacheln, unabhängig von Autorenauflösung und weiterhin innerhalb des
64-Kachelbudgets. Blockindex-Updates verwenden vorbereitete SQL-Anweisungen für
den gesamten Durchlauf. Bodenfarben suchen/holen Reliefdaten nicht mehr je Pixel neu.
Unsichtbare beziehungsweise im Maßstab ausgeschlossene Kartenbeschriftungen
verbrauchen keine Schriftmessungen oder sichtbaren Platzierungsslots.

## Geprüft und gemessen

129 Transportverträge, Typprüfung, 362 Frontendtests und 320 Rusttests
bestanden; fünf ausdrücklich ignorierte Rustfälle bleiben separat. Clippy,
Formatprüfung und Webbuild bestanden. Lokal meldeten zunächst alle 222 Browserfälle
Erfolg; die Gesamtshell lieferte danach Exitcode 143, eine Browser-Nachprüfung 0.

Der erste CI-Lauf bestand 217 von 222 Browserfällen und deckte verlorene erste
Gesten nach Panelwechseln sowie eine unzureichende Mausrad-Bestätigung im Test auf.
Bekannte Layoutwechsel werden jetzt vor der nächsten Eingabe ausgemessen. Echte
Größenänderungen brechen die alte Geste vor Veröffentlichung der neuen Größe ab;
verspätete Doppelmeldungen dürfen die nächste Geste nicht abbrechen. Ein gezielter
Test reproduzierte den Verlust vor der Korrektur und besteht danach einschließlich
echtem Resize-Abbruch. Alle 15 betroffenen Browserfälle und drei weitere
Datei-/Resize-Grenzfälle bestehen lokal; 362 Frontendtests, Typprüfung, Format und
nativer Release-/RPM-Build sind nach der Korrektur erneut grün. Die vollständige
CI-Abnahme mit nun 223 Browserfällen steht erneut aus.

Der frische native Release-Build samt RPM wurde erfolgreich gebaut. Im nativen
X11/WebKit-Fenster (1440×960) zeigte derselbe 80-Pixel-Weltpinselpfad zwei wachsende
Geländestände vor dem Loslassen, auch nach der Layoutkorrektur. Die erste
Hausgeste direkt nach dem Werkzeugwechsel wurde ebenfalls nativ geprüft.
Ein Undo stellt den leeren Ozean wieder her;
Redo entspricht den fertigen Kartenpixeln. Die native Prüfung ist ein
Funktionsnachweis, keine native Latenzmessung oder vollständige Bedienabnahme.

Genau eine kleine Release-Vergleichsreihe mit je drei identischen Weltstrichen
(1440×960, DPR 1, 80-Pixel-Landpinsel) ist abgeschlossen. Erste sichtbare Änderung:
vorher 275–304 ms, danach 119–134 ms. Sichtbare Bestätigung p95: vorher
427–516 ms, danach 339–376 ms. Nachlauf nach Loslassen: vorher 259–427 ms,
danach 231–345 ms. Das 50-ms-Ziel ist damit noch nicht erreicht. Die anschließend
verkleinerten Darstellungskacheln und weiteren lokalen Zeichenoptimierungen sind
in diesen Zeitwerten noch nicht enthalten; keine zusätzliche Messreihe gestartet.

## Offene Abnahme und nächste Arbeit

Native Datei-/Eingabeabnahme über den geprüften Weltstrich hinaus,
RPM-Installation sowie große Stadt-/Weltlastfälle
bleiben offen. PR #1437 enthält den linearen Integrationsstand; Auto-Merge
wartet auf den verpflichtenden CI-Check. Die ursprüngliche lokale Historie bleibt
im Branch `codex/atlas-v7-preserved-histories` erhalten.

Nächster Schwerpunkt bleibt das 50-ms-Ziel für bestätigte Pinselbilder. Ein
zusätzlicher SQL-Versuch zeigte globale Hausfilterarbeit bei lokalen Kartenreads;
der Versuch wurde zurückgenommen, weil ein ausschließlich räumlicher Zugriff
Weltansichten mit vielen kleinen Häusern verteuern könnte. Eine spätere Lösung
muss beide Fälle begrenzen. Der native Direktstrich zeigt während ausstehender
Writes noch die allgemeinen Übernehmen-/Abbrechen-Aktionen; deren Darstellung
sollte an den bereits bestätigten Strichvertrag angepasst werden.

Der parallel vorhandene umfangreiche Release-Treiber und seine neun Fixtures
wurden hier nicht ausgeführt; diese Arbeit verwendet nur den kleinen Weltfall.
Toolchain-Dateien und die übrigen vorhandenen Arbeitsänderungen bleiben erhalten.

Belege und Sicherung: `src-tauri/target/diagnostics/world-brush/`.
Browserbilder und Fehlerkontexte: `src-tauri/target/diagnostics/playwright-*/`.
