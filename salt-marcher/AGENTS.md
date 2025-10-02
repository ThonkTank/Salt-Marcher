# Ziele
- Bündelt die spielinterne Salt Marcher Anwendung inklusive Frontend-Code, Tests und Build-Konfiguration.

# Aktueller Stand
- `src` beherbergt alle App- und Core-Module mit eigenen AGENTS-Leitplanken.
- `tests` führt Vitest-Suites nach Bereichen gruppiert.
- Root-Dateien (`package.json`, `tsconfig`, Buildskripte) steuern Bundling, Typen und Laufzeitkonfiguration.

# ToDo
- Build-Dokumentation ergänzen, sobald weitere Bundler/Targets unterstützt werden.
- Automatisierte Prüfung für fehlende AGENTS- oder Header-Kommentare ins CI überführen.

# Standards
- Neue Verzeichnisse müssen direkt eine `AGENTS.md` erhalten.
- Skripte und Tests führen Header-Kommentare gemäß Root-Vorgabe.
- Build-/Config-Änderungen erfordern Update der zugehörigen Dokumentation.
