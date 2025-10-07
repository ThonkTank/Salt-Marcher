# Ziele
- Stellt die gemeinsamen Travel-Komponenten für das Cartographer-Leaf bereit.
- Dokumentiert Interaktions- und Rendering-Kontrakte für Toolbar, Quick-Steps und Leaf-Shell.
- Sicherstellt, dass UI-Elemente ohne Frameworks (reines DOM) montierbar sind und klare Handles exportieren.

# Aktueller Stand
- Komponenten sind neu und werden primär vom Cartographer-Travel-Sidebar verwendet.
- Layout basiert auf Utility-Klassen aus `src/ui` und BEM-artigen Klassen mit Präfix `sm-almanac-travel`.

# ToDo
- [P2] Nach Integration zusätzlicher Panels (Timeline/Grid) Tests mit JSDOM ergänzen.

# Standards
- Jede Datei startet mit Pfadkommentar und kurzem Zweck-Satz.
- Komponenten exportieren ein Handle-Objekt mit `root` sowie Update-/Destroy-Methoden und setzen `displayName` als statische Eigenschaft.
- DOM-Events werden zentral registriert und bei `destroy()` entfernt.
- Styling-Klassen folgen dem Schema `sm-almanac-travel__<block>` bzw. `--modifier`.
