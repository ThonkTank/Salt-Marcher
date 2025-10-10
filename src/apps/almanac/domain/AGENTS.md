# Ziele
- Enthält die Core-Domain des Almanacs (Kalender, Zeitarithmetik, Wiederholregeln, Phänomene).
- Liefert pure Business-Logik ohne Obsidian-Abhängigkeiten, damit Tests schnell und deterministisch bleiben.

# Aktueller Stand
- `calendar-core.ts` bündelt Schema-, Timestamp- und Zeitarithmetik-Helfer für alle Kalenderberechnungen.
- `scheduling.ts` vereint Event-/Phänomen-Modelle, Wiederholregeln, Konfliktauflösung und Hook-Sortierung in einem Modul.
- Vitest-Suites prüfen zentrale Kantenfälle (Sub-Tages-Schritte, Schema-Clamping, Prioritätensortierung).
- Wiederkehrende Events inkl. Astronomie-Resolver und Konfliktauflösung sind über die konsolidierten Exporte verfügbar.

# ToDo
- [P1] Recurrence-Engine um astronomische & benutzerdefinierte Regeln erweitern.
- [P2] Konfliktauflösung zwischen Events & Phänomenen implementieren (Merge-/Reschedule-Flows).
- [P3] Performance-Profiling für große Zeitbereiche (Lazy-Chunks, Cache-Strategien).

# Standards
- Domain-Module bleiben frei von UI- oder Gateway-Abhängigkeiten (keine DOM-/Obsidian-Imports).
- Neue Hilfsfunktionen erhalten begleitende Unit-Tests und JSDoc-Kommentare.
- Bevorzugt reine Datenstrukturen (`readonly`), Mutationen ausschließlich in expliziten Utility-Funktionen.
