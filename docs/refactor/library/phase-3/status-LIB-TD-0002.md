# LIB-TD-0002 – Umsetzung & Nachweis

## Plan
- Sampling-Strategie auf ≥3 Fixtures je Domäne (Creatures, Items, Equipment, Spells) erweitern und Golden-Zielstruktur definieren.
- Update-Skript für deterministische Generierung (`npm run golden:update`) entwerfen und auf Harness-/Serializer-Verwendung abstützen.
- Roundtrip-Tests aufsetzen, die Golden-Diffs sowie Storage-Lesewege und Serializer-Ausgaben gegeneinander prüfen.

## Umsetzung
- Fixtures der Library-Domänen um je ein drittes, repräsentatives Beispiel ergänzt (u. a. Glimmerfen Stalker, Thundercoil Net).
- Golden-Verzeichnis `tests/golden/library` mit Manifesten und Markdown-Goldens befüllt; SHA256-Prüfsummen sichern Unveränderlichkeit.
- Skript `tests/contracts/update-library-golden.ts` legt Golden-Dateien neu an und räumt Altbestände automatisiert auf.
- Vitest-Suite `tests/contracts/library-golden.test.ts` validiert alle Samples domainübergreifend und nutzt denselben Harness.

## Tests
- `npm run golden:update`
- `npm run test:contracts`

## Dokumentation
- Kanban-Eintrag auf „Ready for Phase 4“ verschoben und BUILD.md um das Golden-Update-Kommando ergänzt.
- Neues Statusdokument für LIB-TD-0002 erstellt.
