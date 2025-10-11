# Ziele
- Stellt den Travel-Workflow als eigenständige Session-Runner-App bereit und entkoppelt ihn vom Cartographer.
- Bündelt Domain-, Infrastruktur- und UI-Bausteine für Reisen, sodass andere Apps (Encounter, Almanac) weiterhin darauf zugreifen können.
- Dokumentiert Controller- und View-Verhalten, damit Lifecycle- und Persistenzpfade klar nachvollziehbar bleiben.

# Aktueller Stand
- `controller.ts` initialisiert die Session-Runner-Ansicht, lädt das Travel-Erlebnis und verbindet Datei-, Render- und Sidebar-Hosts.
- `index.ts` exportiert View, View-Typ und Öffnungshelfer analog zu den übrigen Apps.
- `travel/` enthält Domain-, Infrastruktur- und UI-Schichten, die zuvor unter `apps/cartographer/travel` lagen und unverändert weiter genutzt werden.
- `view/` bündelt das eigentliche Travel-Erlebnis (`experience.ts`) sowie die zugehörigen Controller (Playback, Interaktionen, Encounter-Gateway).

# ToDo
- keine offenen ToDos.

# Standards
- Neue Dateien starten mit einem Kontextsatz zum Nutzerziel.
- Lifecycle-Hooks müssen Abos, Listener und Klassenänderungen idempotent aufräumen.
- Anpassungen an Domain-Typen (`travel/domain/types.ts`) sind mit Encounter-Store und Event-Builder abzugleichen.
- UI-Komponenten bleiben abhängigkeitsarm und kommunizieren Fehler sowohl via Logger als auch über UI-Status.
