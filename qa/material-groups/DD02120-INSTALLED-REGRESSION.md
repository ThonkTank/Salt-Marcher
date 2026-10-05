# DD-021.20: enger Pfad-Undo-Regressionslauf vorbereitet

Der bisherige Gruppenlauf `qa/groups/material-pfad/evidence/1791199562154-material-pfad-edit` meldete für DD-021.20 `pass`, aber dessen Build `a357c691…` ist älter als die derzeit installierte `main.js` mit SHA-256 `d9f6549d081a9d22fd93fb901a0c2eef66e2c6ee139d50b41c50bff5953d53cf`. Das komplette heutige `material-pfad.cjs` prüft außerdem weitere 26 Fälle, einschließlich bekannter offener Pfadwirkungen. Daher ist `DUNGEON_QA_ONLY_DD02120=1` als kurze, getrennte QA-Folge vorbereitet. Sie registriert DD-021.20 genau einmal; alle anderen Gruppenfälle bleiben in diesem Sonderlauf `open`.

Der Modus prüft die lokale Original-PCK-Prüfsumme, lädt `Battlements` als eingebautes Pfadasset ohne Zusatzpaket, zeichnet einen horizontalen Zweipunktpfad, fotografiert Entwurf/Ergebnis, prüft die Materialreferenz und löst **ein** Undo aus. `pass` verlangt danach null Pfade, genau das Dokument vor der Platzierung und den ursprünglichen Historienstand. Es gibt keine Reopenphase und keine Aussage zu Pfadpixeln, Redo oder anderen Modi. Alle QA-Daten gehen in einen isolierten Root außerhalb des Nutzervaults.

Nach Übernahme **nur** des neuen `tools/groups/scenarios/material-pfad-undo.cjs` und des dreizeiligen Sondermodus-Hooks in den aktuellen Main-Runner, mit zugewiesenem Grafikslot aus `/home/aaron/.cache/dungeon-native-qa/implementation-20261005/main`:

```sh
DUNGEON_QA_ONLY_DD02120=1 \
DUNGEON_PLUGIN_ROOT='/home/aaron/Schreibtisch/Obsidian/DnD OT/.obsidian/plugins/dungeon-editor' \
DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd02120-installed-regression \
node tools/host-test.cjs --group material-pfad
```

Der vollständige `material-pfad.cjs`-Stand im Materialzweig ist älter als der Main-Stand. **Nicht** die ganze Datei überschreiben: Main enthält neuere Textur-Mesh-, Width- und Reopen-Prüfungen. Der Koordinationschat integriert nur den Hook am Anfang der Exportfunktion und das neue Modul. Der Runner schreibt `build.json`, `dd02120-steps.json`, Bilder, `group-cases.json` und `result.json`. Die Build-SHA in `build.json` muss vor einer Abnahme exakt der installierten d9-SHA entsprechen.

Statisch geprüft: beide Szenariodateien bestehen `node --check`; `tests/material-pfad-undo-scenario.test.cjs` bestätigt bei einem simulierten Vorabbruch alle 27 Fallrecords genau einmal und eine explizite Fehlerlücke. **Kein** grafischer Host wurde hier gestartet.
