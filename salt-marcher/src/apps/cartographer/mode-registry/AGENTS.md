# Ziele
- Verknüpft Editier-, Reise- und Inspektionsmodi mit ihren Factory-Funktionen.

# Aktueller Stand
- `registry.ts` verwaltet Registrierungen, `providers` liefert konkrete Fabriken.
- Fehlpfad: `CartographerView` kapselt `provideCartographerModes()` in `try/catch`, loggt Fehler und liefert eine leere Modusliste;
  der Presenter protokolliert gescheiterte Registry-Abos, damit die Shell ohne Provider stabil bleibt.

# ToDo
- keine offenen ToDos.

# Standards
- Registrierungsfunktionen beschreiben den Moduszweck im Header.
- Provider werden über eindeutige Schlüssel exportiert (`register<Modus>`).
