# Ziele
- Stellt das deklarative Create-Spec für Kreaturen bereit.
- Bündelt alle Creature-spezifischen Controls, Sections und Presets in diesem Modul, sodass das Workmode-Create-Framework nur generische Infrastruktur enthält.

# Aktueller Stand
- `create-spec.ts` validiert Statblock-Daten und montiert die lokalen Section-Helfer.
- `sections.ts`, `section-*.ts` und `components/` liefern Creature-spezifische UI-Elemente, die auch von Tests und Presets konsumiert werden können.
- `index.ts` re-exportiert das Toolkit für Altskripte, die noch auf `library/create/creature` verweisen.

# ToDo
- [P4.3] Spell-Ladeprozess im Modal mit Lade-/Fehlerzustand versehen.

# Standards
- Das Spec beschreibt alle Felder des Formulars in der gemeinsamen Modal-API.
- Neue UI-Helfer werden innerhalb dieses Verzeichnisses abgelegt und in `index.ts` exportiert.
- JSDoc dokumentiert öffentliche Exporte und erläutert den Speicherpfad der erzeugten Dateien.
