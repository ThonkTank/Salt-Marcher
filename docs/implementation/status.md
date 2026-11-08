# Aktueller Stand

Stand: 8. November 2026. Regulärer Produkteinstieg: Atlas V7, Dateiformat 22,
Generierungsrezept 4. Der zusätzliche Atlas-P0-Versuch verwendet ein eigenes
Dateiformat 23 und ist noch keine Produkt- oder Leistungsfreigabe.
[README](../../README.md) enthält Befehle, [Architektur](../architecture.md)
Zuständigkeiten, [Produktvertrag](../product-contract.md) Verhalten und Grenzen.

## Aktueller Auftrag und Entscheidung

Aaron hat nach Sichtung des [Neubauplans](atlas-rebuild-plan.md) ausdrücklich
den vorgeschlagenen ersten Machbarkeitsversuch beauftragt: kleiner echter
Höheneditor, Datei-Rundlauf und belastbare Messprüfung. Dieser Auftrag umfasst
den P0-Versuch; P1–P9 sind damit nicht gestartet. Arbeitsbranch:
`work/atlas-p0-feasibility`, auf Planstand
`88e24a05120cb398eb732d46a3ae6806c428b3e5`, dessen Produktbasis
`1bb3932fcffcb2d5fea47fae616c3b69489443bc` ist.

Der bevorzugte Aufbau ist als optional startbare Anwendung implementiert:
Electron 44.10.2, TypeScript, React-Panels, Pixi 8.22.0/WebGL und SQLite über
`better-sqlite3` 13.0.3 in einem eigenen Utility-Prozess. Eine lokale Änderung
aktualisiert zuerst das autoritative Dokument und dessen Darstellung; der
Speicherprozess bestätigt sie danach. Ein Worker liest eigene unveränderliche
Quelldaten. Der kleine fachliche Durchlauf funktioniert. Ob dieser Aufbau die
vereinbarten nativen Latenzen erreicht, ist weiterhin offen; **P0 ist blockiert**.

## Implementierter und geprüfter Teil

- Sparse relative Höhenkacheln, einmalige Sättigung der summierten Höhe,
  begrenzte Quellen-/Darstellungs-/Historybudgets, explizit unbekannte und
  bestätigte leere Quellen. Grobes Anheben schreibt die feinen Grabenquellen
  nicht um. Ein Randfall sichert die unterschiedliche Rasterausdehnung an der
  Weltgrenze; alte Workerantworten dürfen neu erzeugte Kacheln nicht ersetzen.
- Echte Eingaben, Werkzeugwechsel, freier Kameraweg, UI-Ortswechsel,
  Undo/Redo und begrenzte Annahme noch nicht bearbeitbarer Pinselstellen.
  Abbruch erhält bereits angenommene Höhenänderungen und verwirft den
  unangenommenen Rest. Dateiwechsel verhindert Eingaben in die alte Session.
- Enger Preload-Vertrag, isolierter Renderer, echte SQLite-Arbeitskopie,
  räumliche Quellenauswahl und geordnete Transaktionen. Speichern reserviert
  einen konsistenten Snapshot vor der Dialogantwort und veröffentlicht ihn
  atomar; spätere Änderungen bleiben ungespeichert. Fehlgeschlagenes Öffnen
  oder Speichern erhält den bisherigen Zustand.
- 53 Tests für Höhenkern, Weltgrenze, Messauswertung, Traceanalyse und die
  Identität tatsächlich gestarteter Pakete bestehen.
  Die Messauswertung verwirft fehlende Werte, unzureichende Stichproben,
  ungültige Zeiten und unbewiesene Präsentationszuordnung. Pointerup und
  laufende Striche haben getrennte Stichproben und Grenzwerte. Kalte Navigation
  verwendet ihre eigenen Zeitbasen und Grenzen (500 ms bis Bereitschaft,
  750 ms bis zum ersten exakten Ergebnis ab Navigation).
- Neun SQLite-Tests bestehen im tatsächlichen Electron-ABI 149, einschließlich
  Snapshot während späterer Writes, fehlgeschlagenem Dateiaustausch,
  beschädigtem räumlichem Index, alten Sessions und zu großen Read-Ergebnissen.
- Die vollständige bisherige Frontendsuite wurde mitgeprüft: 474 Tests
  bestanden, fünf Fälle einer Suite wurden wegen fehlendem `cargo` nicht
  ausgeführt; deren Rust-Testserver konnte nicht starten. Das ist keine
  vollständig grüne Repository-Prüfung. Spätere P0-Ergänzungen sind in den
  oben genannten 53 aktuellen P0-Tests enthalten.

**Geprüfter Codecommit:** `cbdc07262e767eab4f6f74ce8309642e894ffb07`, gebaut aus
sauberem Arbeitsbaum. Der anschließende Dokumentationscommit verändert diesen
Code nicht. Quellhash:
`da743d04a7c11eb7b7808e8fa0d1af60ce449b82824481115cb7f816f7edbd4d`.
Der tatsächlich gestartete Forge-Paketstand hat SHA-256
`4d7a1e492b1293265ad1b98d8f357bba7c1c3847551e4b93eac688da3649e679`.

Der Abschlusslauf unter `artifacts/atlas-rebuild/p0-final/packaged-final/`
besteht mit **13 Funktionskriterien und drei Renderkontrollen** (Exit 0).
Alle sechs Prozessstarts verwenden das gebaute Paket ohne Entwicklungsserver;
Manifest und Quell-/Lockhash werden aus der tatsächlich ausgeführten Anwendung
geprüft. Fehlendes oder abweichendes Paketmanifest bricht die Prüfung ab.
Das Fenster misst 1440 × 960 bei DPR 1, der geprüfte Kartenausschnitt 1180 × 894.
Die sichtbare Küstenverschiebung wurde zusätzlich anhand der Vorher-/Nachherbilder
geprüft; die feinen Höhenpayloads bleiben bytegleich. Bearbeitung während eines
wirklichen SQLite-Snapshots bei aktivem Rechenworker ist zeitlich belegt.

Die Kontrolle mit 250 ms absichtlicher Renderverzögerung wird als zu langsam
abgewiesen; ausbleibendes Zeichnen wird als fehlende exakte Submission erkannt.
Ein frischer Normalstart stellt die Darstellung wieder her, erhält aber nur
`PROXY_ONLY`. Diese Kontrollen qualifizieren keine native Präsentationsmessung.
Der vollständige Abnahmeauswerter endet am selben Bericht korrekt mit Exit 1;
der native Startversuch mit Exit 2 (`NO_NATIVE_DISPLAY`).

Build-/Storelog, Unitlog, Paketlog und die blockierte native Vorprüfung liegen
daneben unter `artifacts/atlas-rebuild/p0-final/`. Rohdaten, SQLite-Fixtures,
Screenshots und Traces bleiben ignoriert. Die TypeScript-Prüfungen und Prettier
bestehen; die Rust-Anteile von Vertrags-, Format- und Gesamtprüfung sind wegen
fehlendem `cargo` nicht ausführbar. Das ist keine vollständige CI-Freigabe.

## Was die Messung bislang belegt und was fehlt

Der Labortreiber bedient eine wirkliche Electron-Anwendung mit Pixi/WebGL,
Preload, Main, Utility-Prozess und SQLite-Datei. Er prüft leere Navigation
mit/ohne Raster, Anheben einer vorbereiteten Küste mit feinem Graben,
unabhängig erwartete Höhen, sichtbare Wasser-/Landpixel, Undo/Redo, unveränderte
Feinpayloads, Speichern, Reopen, echten Prozessneustart sowie einen zunächst
ungeladenen Zielort. Ein Rechenworker bearbeitet echte Höhenquellen. Der
Speicherprozess protokolliert tatsächliche Snapshot-/Publishintervalle;
Bearbeitung unter gleichzeitigem Speichern zählt nur bei nachgewiesener
zeitlicher Überlappung. Ein früher oder später abgeschlossener Save genügt nicht.

Diese Umgebung bietet Softwaregrafik (ANGLE/SwiftShader) und eine virtuelle
Displayfrequenz von 0 Hz. Sie ist keine native Referenzmaschine. Eingabe bis
exakte Renderübergabe wird nur als Diagnose ausgegeben. Ein Chromium-Trace
zeigt konkret, dass der auf ein Eingabeereignis reagierende Frame noch altes
Terrain enthalten kann und die exakte Geländeänderung erst in einem späteren
Frame abgegeben wird. Die Traceauswertung erhält 64-Bit-Framekennungen als
Strings, statt sie beim JSON-Einlesen zu runden.

Auch die diagnostischen Einzelwerte sind keine Zeitfreigabe: Im finalen Lauf
braucht die Live-Eingabe des Grobhubs **56,4 ms bis zur Renderübergabe**, Pointerup
45,8 ms. Schon die erste Untergrenze überschreitet damit 50 ms. Unter Last waren
es im vorausgehenden Paketlauf 50,2 ms und im Abschlusslauf 17,4 ms; beide Proben
bleiben erhalten. Die kalte Einzelprobe erreicht Bereitschaft nach 22,9 ms und
Renderübergabe nach 447,1 ms ab Navigation. Das sind wenige Softwareproben ohne
Präsentationszeit; daraus wird kein belastbarer p95 und kein Bestehen von M10
abgeleitet. Der frühere Lauf liegt getrennt unter `p0-final/packaged-run/`.

Folgende Kriterien bleiben offen beziehungsweise blockiert:

1. **P0a:** Die kurze native V7-Vergleichsreihe fehlt. Hier fehlen Rust-Werkzeuge,
   ein gebauter V7-Host und ein qualifiziertes natives Display.
2. **P0b:** Die beweisbare Verbindung von semantischer Atlas-Rendergeneration
   zur tatsächlich verbrauchten Canvasressource und zum präsentierten
   Compositorframe ist noch nicht implementiert. Zeitnähe, RAF, Cursorbilder
   und Renderübergabe sind kein Ersatz. Die native Hardware-/Displayreferenz
   und Clockkalibrierung fehlen ebenfalls.
3. **P0c/M10:** Der Treiber führt einen funktionalen Pilotlauf aus. Die vollständige
   Sammlung der vorgeschriebenen Stichproben in drei unabhängigen nativen
   Release-Läufen ist noch nicht implementiert und durchgeführt. `--full`
   oder `--native` machen aus dem Pilotlauf keine bestandene Abnahme.
4. **Auslieferung:** Forge kann ein eigenständig startbares Linux-Verzeichnis
   bauen. Ein RPM wurde hier nicht gebaut oder installiert; `rpm`/`rpmbuild`
   fehlen. Der Paketstart ersetzt diese Prüfung nicht. Der Pilot beantwortet
   OS-Dateidialoge über den Testadapter; die echte native Dialogbedienung ist
   ebenfalls noch offen.
5. **Skalierung und spätere Funktionen:** Der kleine Bestand belegt keine
   Weltgröße. Der bisherige Öffnungspfad scannt den Quellindex beim Aufbau
   der Arbeitskopie; große Dateien, vollständige Dateifehlerprüfung,
   sämtliche Werkzeuge, Wasser-/Fundamentfolgen und Lastprofile gehören
   weiterhin zu den nachfolgenden Planpaketen. Der P0-Rechenjob ist eine
   begrenzte Höhenabtastung und kein Hydrologie-Nachweis.

Nächster erforderlicher Schritt ist die fehlende Präsentationszuordnung am
gebauten Kandidaten, anschließend die kurze alte Baseline und die vollständige
P0-Stichprobe auf einer festgehaltenen nativen Referenz. Erst deren Ergebnis
entscheidet über die Leistungsfähigkeit des Ansatzes. Der aktuelle Treiber
weist fehlende Voraussetzungen ausdrücklich als Fehler beziehungsweise
Blockade aus; Grenzwerte werden nicht an die Umgebung angepasst.

## Bisheriger Produktstand und Integration

Die früher dokumentierten V7-Nachweise betreffen Höhen-/Landschaftsarbeiten,
stabile Geometriecaches, Kameramittelpunkt, Eingabeübernahme, Kartenschrift,
Dachdetails und lokale Materialkachelzuordnung. Main enthält PR #1464 als
`288582d19`; die geprüfte Kamerakorrektur und die Dachpixel-Probe wurden im
vorherigen Arbeitsstand gesondert geprüft. Diese historischen Funktions- und
Buildnachweise gelten nicht für den neuen Electron-Pfad. Die frühere kleine
native Strichreihe hat das Ziel p95 ≤50 ms ebenfalls nicht belegt.

Aaron hat Push und Draft-PR zu `ThonkTank/Salt-Marcher` ausdrücklich freigegeben.
Der Kandidat auf `work/atlas-p0-feasibility` wird als Draft-PR gegen
`planning/atlas-rebuild-20261108` veröffentlicht. Der zuvor blockierte
Veröffentlichungsschritt ist damit autorisiert; die Freigabe ersetzt keine
technische Abnahme und erweitert den Auftrag nicht auf P1–P9.

`Candidate · exact-SHA aggregate`, native Leistungsabnahme und Übernahme nach
Main stehen weiterhin aus. Die bestehenden Checks wurden nicht abgeschaltet;
`check:all` enthält zusätzlich den P0-Build und die SQLite-Prüfung im tatsächlichen
Electron-ABI. Die Formatprüfung umfasst auch die neuen Desktopdateien.
