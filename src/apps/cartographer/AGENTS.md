# Ziele
- Liefert den zentralen Arbeitsbereich zum Erstellen und Inspizieren von Hexkarten.
- Orchestriert den Wechsel zwischen Editor- und Inspector-Modus sowie Datei-/Map-Management für beide Flows.
- Stellt einen fokussierten Controller bereit, der Modi, Map-Management und UI-Rendering bündelt.

# Aktueller Stand
## Strukturüberblick
- `index.ts` registriert die `CartographerView`, kapselt die ItemView-Metadaten und verbindet Obsidian-Leaves mit dem Controller.
- `controller.ts` hält aktives File, Karten-Handles und Modusstatus zusammen und rendert Header, Map und Sidebar direkt.
- Der Controller verwaltet ein statisches Array aus Mode-Deskriptoren mit Lazy-Imports für Editor- und Inspector-Modus.
- `editor/` bündelt Kartenwerkzeuge; der Travel-Workflow liegt nun in `apps/session-runner`.

## Integration & Beobachtungen
- `CartographerController` lädt Modi lazy aus den fest verdrahteten Deskriptoren und hält deren Handles für Tests bereit.
- Fehlschläge beim Laden oder Rendern aktivieren eine Overlay-Notiz im Controller und erzeugen zusätzlich eine Obsidian-Notice.
- Mode-Wechsel nutzen eigene AbortController, sodass lange laufende `onEnter`-/`onFileChange`-Routinen sauber abgebrochen werden können.

# ToDo
- keine offenen ToDos.

# Standards
- Modus-Dateien starten mit einem Satz zum Nutzerziel; Handler bündeln Ereignisketten über Imperativ-Verben (activate, hydrate, teardown).
- Lifecycle-Hooks registrieren nur dann Events oder Abos, wenn sie diese beim Schließen wieder entfernen.
- Fehler, die die Modus-Auswahl beeinträchtigen, werden sowohl geloggt als auch im UI kommuniziert (Overlay oder Notice).
