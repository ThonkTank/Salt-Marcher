# Ziele
- Enthält die Core-Domain des Almanacs (Kalender, Zeitarithmetik, Wiederholregeln, Phänomene).
- Liefert pure Business-Logik ohne Obsidian-Abhängigkeiten, damit Tests schnell und deterministisch bleiben.

# Aktueller Stand
- Kalenderarithmetik, Timestamp-Vergleiche und In-Memory-Schema-Helfer sind umgesetzt.
- Wiederholregeln (jährlich, Monatsposition, Wochenindex) und Phänomen-Engine berechnen Vorkommen auf Schema-Basis.
- Vitest-Suites prüfen zentrale Kantenfälle (Sub-Tages-Schritte, Schema-Clamping, Prioritätensortierung).

# ToDo
- [P1] Recurrence-Engine um astronomische & benutzerdefinierte Regeln erweitern.
- [P2] Konfliktauflösung zwischen Events & Phänomenen implementieren (Merge-/Reschedule-Flows).
- [P3] Performance-Profiling für große Zeitbereiche (Lazy-Chunks, Cache-Strategien).

# Standards
- Domain-Module bleiben frei von UI- oder Gateway-Abhängigkeiten (keine DOM-/Obsidian-Imports).
- Neue Hilfsfunktionen erhalten begleitende Unit-Tests und JSDoc-Kommentare.
- Bevorzugt reine Datenstrukturen (`readonly`), Mutationen ausschließlich in expliziten Utility-Funktionen.
