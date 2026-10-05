# Bau-Punktgesten: isolierter Hostprüffall

**Fälle:** DD-013.02, DD-013.03, DD-014.01, DD-014.02 aus `bau-01`.
**Modul:** `tools/groups/scenarios/bau-point-gestures.cjs`.
**Status:** nur statisch geprüft; kein grafischer Host gestartet. Der Grafikslot liegt bei Material.

## Originalmaßstab

Der direkte Dungeondraft-1.2.0.1-Befund steht in
`/home/aaron/.cache/dungeon-native-qa/implementation-20261005/bau/qa/groups/BAU-01-NATIVE-RESULT.md`.
Die Rohbelege liegen unter
`/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/groups/bau-01/native/runs/`:

| Fall | Direkter Beleg | Sollwirkung |
| --- | --- | --- |
| DD-013.02 | `20261005-123725-2939198/evidence/maps/F21-backspace-after.dungeondraft_map`, `F22-backspace-undo.dungeondraft_map`, `F23-backspace-redo.dungeondraft_map`; Frischöffnung in `20261005-124333-2959170` | Backspace auf grün markiertem Griff: 4→3 Punkte, QAWall01-Wand bleibt; Undo/Redo und frisches Öffnen. |
| DD-013.03 | `20261005-123725-2939198/evidence/maps/F26-triangle-before-min.dungeondraft_map`, `F28-triangle-backspace-after.dungeondraft_map`; Frischöffnung im folgenden Lauf | Erneutes Backspace am Dreipunkt-Building verändert Boden/Wand nicht. |
| DD-014.01 | `20261005-122416-2900021/evidence/screens/E13-insert-held.png`, `evidence/maps/E14-insert-after.dungeondraft_map`, `E16-insert-redo.dungeondraft_map` | Zug von Kantenmitte fügt Punkt ein; Boden und Wand folgen schon in der Vorschau; Undo/Redo. Frischöffnung dieses einfachen Zustands fehlt originalseitig. |
| DD-014.02 | `20261005-122416-2900021/evidence/maps/E19-portal-after.dungeondraft_map`, `E22-portal-insert-after.dungeondraft_map`, `E24-portal-insert-redo.dungeondraft_map`; Frischöffnung `20261005-123029-2917265/evidence/maps/E26-portal-fresh-reopen-saved.dungeondraft_map` | Gebundenes Portal bleibt bei (6,3), seine Kantenzuordnung wandert 2→3; Undo/Redo und frisches Öffnen erhalten das Ergebnis. |

## Hostfolge

Das Modul setzt in einem isolierten QA-Vault drei Karten auf. Die erste enthält
ein QAWall01-Building, dessen 4→3-Löschung, minimale Kontur, Einzel-Undo/Redo,
Wand-Sprite und gespeicherter Stand geprüft werden. Die zweite enthält ein
Dreieck für den Kantenmittelpunkt-Zug mit Vorschau, 3→4 Punkten und
Undo/Redo. Die dritte enthält ein Building mit gebundenem Portal: Nach dem
Kantenmittelpunkt-Zug müssen das Portal bei (6,3), die Bindung am Building und
die Kante 2→3 erhalten bleiben. Alle drei Karten werden gespeichert und in
einer getrennten Reopen-Phase gegen Dokument und Dateiprüfsumme geprüft.

Die edit-Phase liefert `bau-point-gestures-edit.json`, Screenshots und
`bau-point-gestures-saved.json`. Die Reopen-Phase liefert
`bau-point-gestures-reopen.json`. Die vier Rückgabewerte enthalten jeweils
`state`, `observation`, `gap`, `evidence`.

## Einbindung in `bau-01`

Der Koordinator importiert das Modul in `tools/groups/scenarios/bau-01.cjs`.
Vor dessen `finish()` wird in Edit oder Reopen genau eine der Funktionen
`runEdit({page,out,qa,vault})` und `verifyReopen({page,out,qa,vault})`
ausgeführt. Ihre vier Rückgabewerte werden über das vorhandene `set` in die
Gruppenbewertung übernommen. Die alten vier `openReasons` sind nach
erfolgreicher Integration nicht mehr maßgeblich. Die Funktion ist als
eigenständige Teilfolge angelegt und startet selbst keinen Host.

## Grenzen der Freigabe

- Für DD-014.01/.02 bleibt ein erfolgreicher Geometrie-Hostlauf `open`, bis die Bildvorschau verglichen ist. Der aktuelle Editor zeichnet beim Kantenmittelpunkt-Zug über `previewBuilding()` nur Umriss und Punktmarker (`src/renderer.ts`); das Original zeigt mitgehenden Boden und Wand. Die reine Punktzahl belegt deshalb keine vollständige Parität.
- DD-014.01 hat zusätzlich eine Originalbeweislücke beim frischen Öffnen genau des einfachen Dreieck→Viereck-Stands. Der Host-Frischstart schließt diese Originallücke nicht.
- Die QA-Löschkarte übersetzt die originale 9×3-Geometrie in den sichtbaren Bereich einer 16×10-Karte. Gesten, Punktzahlen und Wandpaket sind gleich; pixelgleiche Ausgangskoordinaten werden nicht behauptet.
- Die drei Geometrien werden gezielt als QA-Ausgangszustand gesetzt. Zeichnen der ursprünglichen Buildings ist Gegenstand anderer Fälle. Paketinstallation und Frischöffnungsprüfung betreffen nur den isolierten Host.
- DD-013.01 (Delete-Taste) ist ausdrücklich nicht eingeschlossen; der Originalbefund ist widersprüchlich.

**Statische Prüfung:** `node --check` und Export-/Falllistenprüfung bestanden. Ein Lauf und Hostbeleg stehen aus; daher keine Fallabnahme.

## Hostversuche 05.10.2026

Die isolierten Edit-/Reopen-Läufe `1791205645062`/`1791205656860` und `1791205747790`/`1791205759541` unter `/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/groups/bau-01/evidence/` blieben für alle vier Punktfälle **open**. Der erste Lauf stoppte beim Hover der zweiten Backspace-Geste. Im zweiten Lauf zeigte die Diagnose am Dreipunkt-Building `tool=select`, `selected=undefined`, `hover=null` und den korrekt auf `(1,2)` abgebildeten Zeiger. Die erste 4→3-Geste und Undo/Redo waren bereits durchlaufen, aber der Teilablauf schrieb vor dem Abbruch noch keinen auswertbaren Fallbericht. Die Auswahl wird nach dem History-Schritt nun vor der Dreipunkt-Geste neu gesetzt; dieser reine Prüfskript-Fix wurde wegen der Zwei-Versuche-Grenze nicht erneut grafisch ausgeführt. Die Editorparität der vier Fälle bleibt unbelegt. Der grafische Testplatz ist frei.
