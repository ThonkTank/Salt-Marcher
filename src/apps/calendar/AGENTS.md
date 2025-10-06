# Ziele
- Plant den neuen Calendar-Workmode innerhalb der Apps-Schicht und dokumentiert Architekturentscheidungen vor dem ersten Code.
- Beschreibt Zuständigkeiten, Integrationen und Migrationspfade für Kalender- und Zeitleistenfunktionen im Zusammenspiel mit Cartographer.
- Liefert eine verlässliche Referenz für spätere Implementierungsphasen inklusive Testankern und Persistenzüberlegungen.

# Aktueller Stand
- Nur Planungsdokumente vorhanden; es existiert noch keine Calendar-spezifische Logik oder UI.
- Anforderungen orientieren sich an wiederkehrenden und einmaligen Ereignissen, eigener Kalenderdefinition und Zeitfortschritt im Cartographer.
- Als Inspirationsquelle steht das separate "Calendarium"-Plugin bereit, das ähnliche Konzepte nutzt (mehrere Kalender, Feiertage, Ereignisse).

# ToDo
- [P1] Finalisiere den Implementierungsplan und stimme die Phasen mit dem Team ab.
- [P2] Ergänze nach jeder Phase eine Fortschrittsnotiz mit Lessons Learned und offenen Fragen.
- [P3] Halte Integrationsverträge mit Cartographer und Core-Modulen aktuell.

# Standards
- Dokumente in diesem Ordner nutzen klare Abschnittsüberschriften (Problem, Ziel, Lösung, Tests) und verlinken relevante Core-/App-Module.
- Jede Datei beginnt mit einer kurzen Einleitung zum Zweck und verweist, falls zutreffend, auf verwandte Komponenten.
- Aktualisiere `apps/README.md` erst, wenn mindestens Phase 1 des Plans umgesetzt wurde.
