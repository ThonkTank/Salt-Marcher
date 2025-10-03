# Ziele
- Führt Begegnungen mit Ereignislogik und Playback im Obsidian-Client aus.

# Aktueller Stand
- `view.ts` rendert die Encounter-Ansicht und bindet Presenter-Events.
- `presenter.ts` vermittelt zwischen Session-Store, Event-Builder und UI.
- `event-builder.ts` übersetzt Travel-Kontext in Encounter-Ereignisse.
- `session-store.ts` hält Zustand, Persistenz und Playbackposition.

# ToDo
- keine offenen ToDos.

# Standards
- Presenter- und Store-Dateien dokumentieren Seiteneffekte im Kopfkommentar.
- Events bleiben serialisierbar, damit Persistenz erleichtert wird.
- View-spezifische Stile liegen im Plugin-CSS und nicht lokal.
