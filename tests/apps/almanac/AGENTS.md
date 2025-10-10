# Ziele
- Bündelt Testspezifikationen und -suites für den Almanac-Workmode.
- Spiegelt die Struktur und Use-Cases aus `src/apps/almanac`.

# Aktueller Stand
- Vitest-Suites für Domain-Layer (Kalenderarithmetik, Wiederholregeln, Phänomen-Engine) sowie Gateway-Integration vorhanden.
- UI-bezogene Tests wurden entfernt, da das Almanac-Frontend nicht mehr ausgeliefert wird.
- Persistenztests für die Vault-Repositories (`calendar-repository.test.ts`, `almanac-repository.test.ts`) sichern Schema- und Filterlogik.

# ToDo
- [P1] Prüfe Testplan und Dokumentation auf veraltete Hinweise zum entfernten Frontend.

# Standards
- Testbeschreibungen verweisen auf zugehörige Spezifikationen unter `src/apps/almanac/mode`.
- Nutze Vitest-Konventionen aus `tests/AGENTS.md` (Arrange/Act/Assert, Headerkommentare).
