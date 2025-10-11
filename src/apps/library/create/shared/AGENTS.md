# Ziele
- Enthält creature-spezifische Shared-Komponenten für die Library-Editoren.

# Aktueller Stand
- `stat-utils` berechnet Wertebereiche, `creature-controls` kapselt Preset-/Resistenz-Editoren.
- Dialog-Grundgerüst, Form-Controls und Token-Editor liegen jetzt unter `src/ui/workmode/create/`.

# ToDo
- [P4.4] Token-Editor um Drag&Drop-Upload erweitern (siehe neues Shared-Modul in `src/ui/workmode/create/`).

# Standards
- Shared-Dateien erläutern, welche Editoren sie beliefern.
- Funktionen bleiben klein und wiederverwendbar ohne Editor-spezifische Annahmen.
