# Development Roadmap

> **Wird benoetigt von:** Aktueller Task

Implementierungsstrategie und aktueller Status für Salt Marcher.

---

## ✅ Implementiert

| Feature | Aspekte |
|---------|---------|
| Travel | Nachbar-Bewegung, State-Machine, Multi-Hex-Routen (Greedy), Weather-Speed-Faktor, Encumbrance-Speed-Faktor, Wegpunkt-UI, Routen-Visualisierung, Auto-Segment-Bewegung, Stunden-Encounter-Checks (12.5%), Auto-Pause bei Encounter, Token-Animation, Path-Preview (Greedy), ETA-Anzeige |
| Weather | Terrain-basierte Generierung, Travel-Speed-Modifier, Persistenz |
| Encounter | 4 Typen, State-Machine, 6-Step Pipeline (inkl. Loot), NPC-Generator, Travel-Integration, XP-Berechnung |
| Combat | Initiative-Tracker, HP-Management, 14 Conditions, Concentration, Time-Integration, XP aus Creatures |
| Quest | State-Machine, 40/60 XP-Split, Encounter-Slot-Zuweisung, Resumable State |
| Party | Character-Schema, Party-Member-Management, getPartyLevel/Speed |
| Inventory | Item-Schema, InventorySlot, Encumbrance, Rations, Travel-Speed-Integration |
| Loot | Tag-Matching, XP-basiertes Budget (0.5 GP/XP), Encounter-Integration, loot:generated Event |
| Map | Hex-Map Rendering, Terrain-System, Weather-Ranges |
| UI | SessionRunner, DetailView, Time-Advance, Weather-Summary |

---

## 🔄 Aktiver Sprint


## ⬜ Backlog

| Bereich | Aspekt | Prio | MVP? | Referenz |
|---------|--------|:----:|:----:|----------|
| Travel | nachbarbewegung entfernen | - | - | [Travel-System.md](../features/Travel-System.md) |
| Travel | Wegpunkt Drag&Drop | - | - | [Travel-System.md](../features/Travel-System.md) |
| Travel | A* Pathfinding | - | Nein | [Travel-System.md](../features/Travel-System.md) |
| Weather | Weather-Events (Blizzard etc.) | mittel | Nein | [Weather-System.md](../features/Weather-System.md) |
| Weather | GM Override | - | - | [Weather-System.md](../features/Weather-System.md) |
| Weather | UI-Anzeige | - | - | [Weather-System.md](../features/Weather-System.md) |
| Encounter | Weather im Context | - | - | [Encounter-System.md](../features/Encounter-System.md) |
| Encounter | Faction-Territory Population | - | - | [Encounter-System.md](../features/Encounter-System.md) |
| Encounter | Multi-Gruppen-Encounters | niedrig | Nein | [Encounter-System.md](../features/Encounter-System.md) |
| Combat | Death Saves UI | - | Nein | [Combat-System.md](../features/Combat-System.md) |
| Combat | Grid-Positioning | mittel | Nein | [Combat-System.md](../features/Combat-System.md) |
| Combat | Legendary/Lair Actions | niedrig | Nein | [Combat-System.md](../features/Combat-System.md) |
| Quest | Quest-Editor | mittel | Nein | [Quest-System.md](../features/Quest-System.md) |
| Quest | Reputation-Rewards | - | Nein | [Quest-System.md](../features/Quest-System.md) |
| Quest | Hidden Objectives | - | Nein | [Quest-System.md](../features/Quest-System.md) |
| Party | XP-Verteilung System | - | - | [Character-System.md](../features/Character-System.md) |
| Party | Character-UI | - | - | [Character-System.md](../features/Character-System.md) |
| Inventory | Equipped-Items (AC/Damage) | niedrig | Nein | [Inventory-System.md](../features/Inventory-System.md) |
| Inventory | Inventory-UI | - | - | [Inventory-System.md](../features/Inventory-System.md) |
| Inventory | Automatischer Rationen-Abzug | mittel | Ja | [Inventory-System.md](../features/Inventory-System.md) |
| Map | Multi-Map-Navigation | - | Nein | [Map-Feature.md](../features/Map-Feature.md) |
| Map | Cartographer (Editor) | - | Teilw. | [Cartographer.md](../application/Cartographer.md) |
| UI | Debug-Panel | - | - | [SessionRunner.md](../application/SessionRunner.md) |
| UI | Transport-Wechsel UI | - | - | [SessionRunner.md](../application/SessionRunner.md) |
| UI | Audio Quick-Controls | - | Ja | [SessionRunner.md](../application/SessionRunner.md) |
| Time | Calendar-Wechsel | niedrig | Nein | [Time-System.md](../features/Time-System.md) |
| Events | Siehe Status-Spalten | - | - | [Events-Catalog.md](Events-Catalog.md) |
| Loot | Hoard-System | hoch | Nein | [Loot-Feature.md](../features/Loot-Feature.md) |
| Loot | Budget-Tracking ueber Zeit | - | - | [Loot-Feature.md](../features/Loot-Feature.md) |
| Loot | GM-Override | - | Nein | [Loot-Feature.md](../features/Loot-Feature.md) |
| Loot | Loot-UI | - | Nein | [Loot-Feature.md](../features/Loot-Feature.md) |
| Loot | Creature defaultLoot | - | Ja | [Loot-Feature.md](../features/Loot-Feature.md) |

---

## Test-Strategie

| Komponente | Stabilität | Test-Ansatz |
|------------|------------|-------------|
| Core | Hoch | ✅ 136 Unit-Tests (inkl. EventBus request()) |
| Features (Iteration) | Niedrig | Manuelles Testen |
| Features (Fertig) | Hoch | Automatisierte Tests nachziehen |

**Kriterium "Test-Ready":** User gibt Freigabe ("Feature ist fertig")

### Schema-Definitionen

| Ort | Inhalt |
|-----|--------|
| `docs/architecture/EntityRegistry.md` | Entity-Interfaces |
| `docs/architecture/Core.md` | Basis-Types (Result, Option, EntityId) |
| Feature-Docs | Feature-spezifische Typen |

Bei fehlenden oder unklaren Schemas: User fragen.

---

## Dokumentations-Workflow

### Bei Phase-Abschluss

1. **Implementiert aktualisieren:**
   - Neue Aspekte zur Feature-Zeile hinzufuegen

2. **Backlog pflegen:**
   - Implementierte Items aus "Offen" entfernen
   - Neue entdeckte Luecken hinzufuegen

3. **Event-Status aktualisieren:**
   - Events-Catalog.md → Status-Spalte auf ✅ setzen

4. **Aktiver Sprint** leeren

### Beim planen neuer Phase

1. "Aktiver Sprint" Sektion mit Template befuellen (siehe unten)
2. NICHT DIE TEMPLATE-STRUKTUR VERAENDERN!

### Aktiver-Sprint Template

```markdown
## 🔄 Aktiver Sprint

_[Status-Zeile, z.B. "Phase X abgeschlossen. Bereit fuer Phase Y."]_

### Phase [N]: [Name]

**User Story:**
> Als [Rolle] moechte ich [Feature], damit [Nutzen].

**Scope (siehe [Feature-Doc.md](../features/Feature-Doc.md)):**
- [ ] Komponente 1
- [ ] Komponente 2
- [ ] ...

**Implementierungs-Fortschritt:**

| Komponente | Status | Anmerkung |
|------------|--------|-----------|

**Nicht im Scope:**
- Ausgeschlossenes Feature 1
- Ausgeschlossenes Feature 2
```

### Prinzipien

| Dokument | Enthält |
|----------|---------|
| **Roadmap** | Phasen-Uebersicht + Implementiert + Backlog |
| **Events-Catalog.md** | Event-Definitionen + Implementierungs-Status |
| **Feature-Docs** | Spezifikation (Ziel-Zustand) |

---

## Verwandte Dokumentation

| Thema | Dokument |
|-------|----------|
| Core-Types | [Core.md](Core.md) |
| Events | [Events-Catalog.md](Events-Catalog.md) |
| Layer-Struktur | [Project-Structure.md](Project-Structure.md) |
| Error-Handling | [Error-Handling.md](Error-Handling.md) |
| Conventions | [Conventions.md](Conventions.md) |
| Testing | [Testing.md](Testing.md) |
