# Ziele
- Bündelt CLI-/Utility-Code zur Konvertierung von Library-Referenzen (Items, Spells, Creatures).
- Stellt Parser-Helfer bereit, die sowohl Build-Skripte als auch App-Layer nutzen können.

# Aktueller Stand
- `convert-references.ts` orchestriert Format-Transformationen und Validierung.
- Unterordner `parsers/` enthält modularisierte Parser für einzelne Referenztypen.

# ToDo
- [P2] Fehlertoleranz erhöhen (konfigurierbare Warnungen vs. Fehler) und Tests ergänzen.
- [P3] Performance-Metriken erfassen, sobald große Referenzpakete verarbeitet werden.

# Standards
- Parser-Funktionen sind pure (keine Seiteneffekte) und werden durch Vitest abgedeckt.
- Änderungen an Datenformaten sind in `docs/library` sowie `BUILD.md` zu dokumentieren.
