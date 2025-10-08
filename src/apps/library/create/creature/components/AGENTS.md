# Ziele
- Kapselt UI-Komponenten für Creature-Entries (Angriffe, Flächen, Effekte, Nutzungslimits).
- Stellt wiederverwendbare Renderer/Validatoren bereit, die im Creator und in Tests genutzt werden.

# Aktueller Stand
- `ui-components.ts` enthält konsolidierte Implementierungen für Area-, Recharge- und Uses-Komponenten.
- Dokumentations-Tests unter `docs/` sichern API und TypeScript-Verträge ab.

# ToDo
- [P2] Weitere Komponenten (Legendary Actions, Lair Actions) extrahieren und testen.
- [P3] Drag-and-Drop-Reihenfolge per Komponente ermöglichen.

# Standards
- Jede Komponente besitzt Kopfkommentar und exportiert Handles/Option-Interfaces.
- Neue Komponenten benötigen begleitende Docs-Tests und Aktualisierung der Creator-Dokumentation.
