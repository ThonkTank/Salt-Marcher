# Traceability Matrix – Phase 3

## Referenzquellen
- **Technical Debt Register (Phase 1)** – `docs/refactor/library/phase-1/technical-debt-register.csv`
- **Risk Log (Phase 1)** – `docs/refactor/library/phase-1/risks.md`
- **Target Architecture & Work Packages (Phase 2)** – `docs/refactor/library/phase-2/work-packages.md`
- **Contracts & ADRs (Phase 2)** – `docs/refactor/library/phase-2/contracts/*.md`, `docs/refactor/library/phase-2/adrs/*.md`

Die nachfolgenden Tabellen verwenden konsistente IDs:
- **Debt-IDs** `D-LIB-###` entsprechen den Einträgen (Reihenfolge wie im Phase-1-Register).
- **Risk-IDs** `R-LIB-###` entsprechen den Risiken aus `risks.md`.

## Technical Debt → ToDo → Work Package

| Debt-ID | Beschreibung (Kurzfassung) | Quelle | ToDo-IDs | Work Package |
| --- | --- | --- | --- | --- |
| D-LIB-001 | Async `render()` & direkte IO-Zugriffe in Renderern | `technical-debt-register.csv` Zeile "Async render promise dropped" | LIB-TD-0003, LIB-TD-0005, LIB-TD-0006, LIB-TD-0013 | WP-A1, WP-B1, WP-C1 |
| D-LIB-002 | Manuelle YAML-Parsing-Pfade in Creatures | `technical-debt-register.csv` Zeile "Manual YAML fallback parsing" | LIB-TD-0006, LIB-TD-0009, LIB-TD-0010, LIB-TD-0013 | WP-B1, WP-B2, WP-C1 |
| D-LIB-003 | Debug-Logging in CreaturesRenderer | `technical-debt-register.csv` Zeile "Debug console noise" | LIB-TD-0015 | WP-C2 |
| D-LIB-004 | Silent JSON Parse (Items) | `technical-debt-register.csv` Zeile "Silent JSON parse failures (items)" | LIB-TD-0002, LIB-TD-0004, LIB-TD-0010 | WP-D1, WP-A1, WP-B2 |
| D-LIB-005 | Dynamische Serializer-Imports (Items) | `technical-debt-register.csv` Zeile "Dynamic serializer import per save (items)" | LIB-TD-0010 | WP-B2 |
| D-LIB-006 | Silent JSON Parse (Equipment) | `technical-debt-register.csv` Zeile "Silent JSON parse failures (equipment)" | LIB-TD-0002, LIB-TD-0004, LIB-TD-0010 | WP-D1, WP-A1, WP-B2 |
| D-LIB-007 | Dynamische Serializer-Imports (Equipment) | `technical-debt-register.csv` Zeile "Dynamic serializer import per save (equipment)" | LIB-TD-0010 | WP-B2 |
| D-LIB-008 | Listener-Duplizierung & Debounce-Risiko | `technical-debt-register.csv` Zeile "Terrain listener duplication risk" | LIB-TD-0007, LIB-TD-0008, LIB-TD-0014, LIB-TD-0015 | WP-A2, WP-C2 |
| D-LIB-009 | Fehlende Encounter-Validierung | `technical-debt-register.csv` Zeile "Region encounter parsing lacks validation" | LIB-TD-0011 | WP-B2 |
| D-LIB-010 | Schwaches Preset-Marker-Handling | `technical-debt-register.csv` Zeile "Preset import marker weak guarantee" | LIB-TD-0004, LIB-TD-0012 | WP-A1, WP-B2 |
| D-LIB-011 | Tests decken nur Shell ab | `technical-debt-register.csv` Zeile "Library tests limited to shell" | LIB-TD-0001, LIB-TD-0002 | WP-D1 |
| D-LIB-012 | Creature-Serializer-Megafile | `technical-debt-register.csv` Zeile "Creature serializer mega-file" | LIB-TD-0009, LIB-TD-0010 | WP-B2 |

## Risks → ToDo → Work Package

| Risk-ID | Beschreibung (Kurzfassung) | Quelle | ToDo-IDs | Work Package |
| --- | --- | --- | --- | --- |
| R-LIB-001 | Async Render Races | `risks.md` Abschnitt "Async render races" | LIB-TD-0003, LIB-TD-0005, LIB-TD-0006, LIB-TD-0013, LIB-TD-0016 | WP-A1, WP-B1, WP-C1, WP-D2 |
| R-LIB-002 | Silent Data Truncation | `risks.md` Abschnitt "Silent data truncation" | LIB-TD-0001, LIB-TD-0002, LIB-TD-0004, LIB-TD-0009, LIB-TD-0010, LIB-TD-0011 | WP-D1, WP-A1, WP-B2 |
| R-LIB-003 | Preset Import Retry Loop | `risks.md` Abschnitt "Preset import retry loop" | LIB-TD-0004, LIB-TD-0012, LIB-TD-0016 | WP-A1, WP-B2, WP-D2 |
| R-LIB-004 | Debounced Save Loss | `risks.md` Abschnitt "Debounced save loss" | LIB-TD-0007, LIB-TD-0008, LIB-TD-0014, LIB-TD-0015, LIB-TD-0016 | WP-A2, WP-C2, WP-D2 |
| R-LIB-005 | Manual YAML Parsing Drift | `risks.md` Abschnitt "Manual YAML parsing drift" | LIB-TD-0003, LIB-TD-0006, LIB-TD-0009, LIB-TD-0010, LIB-TD-0013 | WP-A1, WP-B1, WP-B2, WP-C1 |
| R-LIB-006 | Encounter Odds Validation Gap | `risks.md` Abschnitt "Encounter odds validation gap" | LIB-TD-0011 | WP-B2 |
| R-LIB-007 | Modal Lifecycle Leak | `risks.md` Abschnitt "Modal lifecycle leak" | LIB-TD-0007, LIB-TD-0008, LIB-TD-0005, LIB-TD-0006, LIB-TD-0016 | WP-A2, WP-B1, WP-D2 |

## ToDo → Work Package Mapping

| ToDo-ID | Work Package | Sequenzpriorität |
| --- | --- | --- |
| LIB-TD-0001 | WP-D1 | 1 |
| LIB-TD-0002 | WP-D1 | 1 |
| LIB-TD-0003 | WP-A1 | 2 |
| LIB-TD-0004 | WP-A1 | 2 |
| LIB-TD-0005 | WP-B1 | 3 |
| LIB-TD-0006 | WP-B1 | 3 |
| LIB-TD-0007 | WP-A2 | 4 |
| LIB-TD-0008 | WP-A2 | 4 |
| LIB-TD-0009 | WP-B2 | 3 |
| LIB-TD-0010 | WP-B2 | 3 |
| LIB-TD-0011 | WP-B2 | 3 |
| LIB-TD-0012 | WP-B2 | 3 |
| LIB-TD-0013 | WP-C1 | 5 |
| LIB-TD-0014 | WP-C2 | 6 |
| LIB-TD-0015 | WP-C2 | 6 |
| LIB-TD-0016 | WP-D2 | 7 |

Die Sequenzpriorität folgt dem in `work-packages.md` beschriebenen Ablauf (Tests → Cycle Removal → Kernels/Templates → Watcher-Isolation → Konsolidierung → Rollout-Kontrollen).
