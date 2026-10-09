# HEX-02-N01: zwei Pflichtbefunde aus R01 schließen

Ausgangspunkt: unabhängiger [HEX-02-R01](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/1#issuecomment-6087387441), exakter Kandidat `c9e37ec749b38bfa71248bae7187c8d20ff5f693`. Verantwortlich: Hex/Atlas, gemeinsamer Branch `active/installed-phase1`, Paketbranch `hex/hex02-n01-20261009`. Keine Orts-, Stadt-, Dungeon-, SMR- oder weiteren Pinseländerungen.

## Pflichtumfang und Verhalten

1. **HEX02-R01-01 / P1:** Prozessverlust nach dem vorbereiteten Kopierjournal und vor der Ziel-Overworld hinterlässt heute eine unerreichbare Kopie. Eine ausdrückliche Wiederherstellung ist bereits im Kopierdialog über den benannten Zielnamen erreichbar, auch wenn die Hauptdatei fehlt. Sie akzeptiert ausschließlich ein streng geprüftes, geschlossenes Neuanlagejournal dieses Ziels: neue Weltdatei, genau ihre referenzierten neuen Terrain-Dateien, keine anderen Pfade, keine Vorherinhalte oder Zielentwürfe. `prepared` nimmt die eigene Neuanlage zurück; `committed` erhält die vollständige Kopie und beendet das Journal. Unbekannte, fremde, beschädigte oder zwischen Prüfung und Übernahme geänderte Bytes bleiben als Konflikt erhalten. Normales Kopieren gewinnt dadurch keine automatische Berechtigung, ein belegtes Ziel zu reparieren.
2. **HEX02-R01-02 / P1:** Nach „Kopie speichern“ ist der akzeptierte Vorgang nicht abbrechbar. Name und Aktionsknöpfe sind gesperrt, sichtbarer Status erklärt den Fortschritt. Escape, X, Außenklick und programmgesteuertes Schließen lassen den Dialog bis zum Ergebnis stehen. Danach gibt es entweder sichtbaren Fehler mit unverändertem Namen oder erfolgreichen Abschluss. Ein inzwischen gewechseltes Quellblatt darf keine verspätete Navigation verursachen; die erfolgreiche Kopie wird dennoch ausdrücklich benannt.

## Getrennte Läufe und Prüfungen

| Lauf | Ergebnis | Konkrete Belege |
|---|---|---|
| N01-P01 | Dieser begrenzte Plan plus R01-Befunde/Checkpoint veröffentlicht | JSON, Verweise, Diff; keine Produktfreigabe |
| N01-I01 | Zielgebundene Wiederherstellung, Busy-Dialog und dünne UI-Anbindung | Neue Adapter nach simuliertem Prozessverlust an jeder Journal-/Kind-/Rootgrenze; prepared/committed, leere Kopie, erneute Kopie, fremde/corrupt/stale Bytes; verzögerte DOM-Prüfung aller Dismisswege und Quellwechsel; check/test/build |
| N01-H01 | Echter isolierter Obsidian-Reparaturablauf | Native Escape/X/Außenklick während verzögerter Kopie, sichtbarer Abschluss/Fehler, Zielwiederherstellung ohne Rootdatei und frischer Prozess; Buildtriplet, genaue Quelldaten, normale Exits und tatsächlich angesehene Bilder |
| R02 | Unabhängiger exakter Kandidatenreview | Die beiden P1 erneut prüfen; keine Pflichtlücke darf offen bleiben |
| CLEAN-P/I/R | Getrenntes begrenztes Aufräumen | Nur konkrete Reste; anschließend HEX-03 |

Geplante Dateien: `src/features/atlas/file-transaction.ts`, `atlas-repository.ts`, neuer kleiner Copy-Recovery-Baustein falls sinnvoll; `src/ui/atlas-view.ts` und eigener testbarer Kopierdialog; gezielte Core-/DOM-Regressionen, Build-Testeintrag, nativer Hosthelfer. Architektur und ausschließlich `checkpoint.hexAtlasExecution`/`acceptance.hexAtlas` werden dem nachgewiesenen Stand angepasst. Fremde Checkpointwurzeln, Originalbelege, lokale Tests und Nutzervault bleiben geschützt.

Die Wiederherstellung verspricht weiterhin den vorhandenen serialisierten Compare/Write-Vertrag, keine POSIX-fsync- oder allgemeine TOCTOU-Garantie. Simulierter Prozessverlust ersetzt keine physische Eingabe- oder Betriebssystem-Crashabnahme. Vollständige Wonderdraft-Parität, Großwelt, gemeinsame City/Location/Dungeon-Bearbeitung und Installation bleiben offen.
