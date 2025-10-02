# Ziele
- Bündelt Arbeitsmodi (Editor, Inspector, Travel Guide) des Cartographer.

# Aktueller Stand
- `editor` und `inspector` initialisieren UI-Panels rund um Hex-Bearbeitung.
- `travel-guide` startet Interaktions-Controller für Routen und Begegnungen.

# ToDo
- Fehlende Modus-Dokumentation ergänzen, wenn neue Modi entstehen.
- Gemeinsame Lifecycle-Helfer extrahieren.

# Standards
- Jede Modulfunktion beschreibt ihr Nutzerziel im Kopfkommentar.
- Modus-Factories exportieren `create<Name>Mode` und kapseln lokalen Zustand.
