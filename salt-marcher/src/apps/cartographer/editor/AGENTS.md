# Ziele
- Hält gemeinsame Infrastruktur für Kartograph-Editor und seine Werkzeugleisten.

# Aktueller Stand
- Leitet derzeit direkt in `tools`, wo Brush-Implementierungen und Manager leben.

# ToDo
- Modus-spezifische State-Container ergänzen, sobald weitere Editoren entstehen.
- Rendering-Hooks dokumentieren, falls außerhalb der Tools benötigt.

# Standards
- Editor-spezifische Module benennen Werkzeuge klar (`*-tool`, `*-brush`).
- Neue Editorkomponenten erhalten Kopfkommentare mit Nutzerabsicht.
