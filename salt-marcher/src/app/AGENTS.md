# Ziele
- Startet das Plugin, registriert Views und lädt Styles.

# Aktueller Stand
- `main.ts` verwaltet Plugin-Lifecycle und View-Anmeldung.
- `bootstrap-services.ts` richtet Datenquellen und Defaults ein.
- `integration-telemetry.ts` fasst Fehlerhinweise der Integrationen zusammen.
- `css.ts` bündelt alle Styles als Export-String.

# ToDo
- Mobile-spezifische Bootstrap-Sequenzen definieren.
- Telemetrie auf weitere Integrationen ausweiten.
- Theme-Hooks (dark/light) dokumentieren, sobald vorhanden.

# Standards
- Einstiegspunkte dokumentieren Lifecycle-Schritte im Kopfkommentar.
- Bootstrap-Helfer kapseln Obsidian-IO in reine Funktionen.
- CSS bleibt im TypeScript gebündelt, bis ein Build-Schritt existiert.
