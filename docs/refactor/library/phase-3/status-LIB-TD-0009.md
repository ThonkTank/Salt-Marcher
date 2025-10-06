# LIB-TD-0009 – Umsetzung & Nachweis

## Plan
- Policy-Schema für Template-Version 1.0.0 modellieren (Required/Default/Migration/Validation/Transform) und Storage-Verknüpfung dokumentieren.
- Telemetrie-Events und Attribute für Migration-, Validierungs- und Transformationspfade definieren, inklusive Default-Plan.
- Validierungs-API erstellen, die Draft-Definitionen prüft (SemVer, Domains, Duplikate) und strukturierte Issues zurückliefert.

## Umsetzung
- `src/apps/library/core/serializer-template/library-serializer-template.ts` erstellt Draft/Template-Typen, Validation, Fehlerklasse sowie Runtime-Hooks und friert Policies, Storage-Bindung und Telemetrie-Pläne ein.
- Telemetrie-Defaults (`library.serializer.*`) sowie Transformer-Pläne (`transform.identifier`) lösen das Briefing-Delta zu Spezialfeldern (Spellcasting JSON) und liefern klare Eventnamen.
- Validation erkennt SemVer-Fehler, Duplicate-Felder, fehlende Codes/Messages sowie ungültige Storage-Strategien und trägt sie in strukturierte Issues ein.

## Tests
- `npm run test -- --run tests/library/library-serializer-template.test.ts`

## Dokumentation
- Kanban-Eintrag von LIB-TD-0009 nach „Ready for Phase 4“ verschoben und neue Artefakte dokumentiert.
- Backlog- und Planning-Brief aktualisieren die Custom-Transformer-Frage als geklärt (`transform.identifier`).
