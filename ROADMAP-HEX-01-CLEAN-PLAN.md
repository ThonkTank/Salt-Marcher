# HEX-01: begrenztes Aufräumen

Grundlage: [Fachplan](ROADMAP-HEX-01-PLAN.md), eigener HEX-01-R01 und `acceptance.hexAtlas.cleanupFindings`. Die acht Fundamentanforderungen sind im angegebenen Umfang geprüft; Gelände, Historie und Entwürfe folgen in HEX-02.

## CLEAN-P01

1. **HEX01-C01:** Ein bereits vorhandener Atlasname zeigt „Ein Atlas mit diesem Namen ist bereits vorhanden. Einen anderen Namen wählen.“ Der eingegebene Name und der Dialog bleiben erhalten. Der allgemeine Speicher-/Öffnungsfehler bleibt für andere Fehler zuständig. Vorhandene Datei nicht verändern.
2. **HEX01-C02:** Nur die neuen Atlasmodule, den neuen Hostadapter und den gezielten Kerntest nach dem vorhandenen Formatter formatieren. Keine Geometrie-, Kamera-, Speicher- oder Gestenänderung.
3. Den nativen Wiederöffnungstest um den echten Namenskonflikt erweitern. Vorher/nachher identische Datei und stabile Weltkennung prüfen; Meldung tatsächlich ansehen. Die vorhandenen beiden Ausrichtungen und die Dungeon-Regression erneut öffnen.

## Getrennte Ausführung und Tore

| Lauf | Ergebnis | Prüfung |
|---|---|---|
| CLEAN-P01 | Nur dieser begrenzte Plan | Verweise, eigener Checkpoint und fremde Wurzeln |
| CLEAN-I01 | Meldung, Lesbarkeit, gezielter Hostfall | Check/Test/Build, native Wiederöffnung und Dateischutz |
| CLEAN-R01 | Eigenständiger Review der beiden Punkte | tatsächliche Meldung/Bild prüfen, Funktion und fremde Änderungen erhalten |

Nach erfolgreichem CLEAN-R01 beginnt HEX-02 unmittelbar mit einem vollständigen Malen-/Abbruch-/Undo-/Speichern-/Entwurfsablauf. Eine weitere allgemeine Wonderdraft-Inventur oder eine neue Kartenoberfläche gehört nicht zu diesem Aufräumpaket. Originalkarten und der installierte Nutzervault bleiben unverändert.
