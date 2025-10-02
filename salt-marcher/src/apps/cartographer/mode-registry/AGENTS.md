# Ziele
- Verknüpft Editier-, Reise- und Inspektionsmodi mit ihren Factory-Funktionen.

# Aktueller Stand
- `registry.ts` verwaltet Registrierungen, `providers` liefert konkrete Fabriken.

# ToDo
- Ereignis-Hooks für dynamische Moduladaption ergänzen, sobald nötig.
- Übergreifende Fehlerbehandlung für fehlende Provider dokumentieren.

# Standards
- Registrierungsfunktionen beschreiben den Moduszweck im Header.
- Provider werden über eindeutige Schlüssel exportiert (`register<Modus>`).
