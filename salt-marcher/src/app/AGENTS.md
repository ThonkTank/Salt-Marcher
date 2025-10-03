# Ziele
- Startet das Plugin, registriert Views und lädt Styles.

# Aktueller Stand
- `main.ts` verwaltet Plugin-Lifecycle, meldet Integrationsfehler und View-Anmeldung.
- `bootstrap-services.ts` richtet Datenquellen und Defaults ein.
- `integration-telemetry.ts` dedupliziert Meldungen zu View-, Ribbon-, Command- und Datensatz-Integrationen.
- `css.ts` bündelt alle Styles als Export-String.

# ToDo
- keine offenen ToDos.

# Standards
- Einstiegspunkte dokumentieren Lifecycle-Schritte im Kopfkommentar.
- Bootstrap-Helfer kapseln Obsidian-IO in reine Funktionen.
- CSS bleibt im TypeScript gebündelt, bis ein Build-Schritt existiert.
