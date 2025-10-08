# Ziele
- Bündelt einmalige und wiederkehrende Node-Skripte für Referenzkonvertierung, Tests und Datenpflege.
- Dokumentiert Eingabe-/Ausgabeformate, damit Automatisierungen nachvollziehbar bleiben.

# Aktueller Stand
- Enthält Konvertierungsskripte (`convert-*.mjs`), Preset-Rebuilder und Testhilfen.
- Skripte werden manuell via `node scripts/<name>.mjs` oder npm-Scripts aufgerufen.

# ToDo
- [P2] CLI-Prüfungen ergänzen (z. B. `--dry-run`) und Logging harmonisieren.
- [P3] Langfristig in Vitest/Build-Pipeline integrieren.

# Standards
- Jedes Skript startet mit Kopfkommentar (siehe `header-policy` Test) und nutzt ES Modules.
- Änderungen am Verhalten müssen in `BUILD.md` und relevanten AGENTS dokumentiert werden.
