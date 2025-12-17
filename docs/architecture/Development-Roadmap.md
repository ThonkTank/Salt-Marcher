# Development Roadmap

> **Wird benoetigt von:** Aktueller Task

Implementierungsstrategie und aktueller Status für Salt Marcher.

---

## ✅ Implementiert

| Feature | Aspekte |
|---------|---------|
| Travel | Nachbar-Bewegung, State-Machine, Multi-Hex-Routen (Greedy), Weather-Speed-Faktor, Encumbrance-Speed-Faktor, Wegpunkt-UI, Routen-Visualisierung, Auto-Segment-Bewegung, Stunden-Encounter-Checks (12.5%), Auto-Pause bei Encounter |
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

_Phase 11 in Arbeit._

### Phase 11: Automatische Segment-Bewegung

**User Story:**
> Als GM moechte ich nach Klick auf "Start" die Party automatisch entlang der Route reisen sehen, mit Zeit-Fortschritt und Encounter-Checks, damit ich die Reise nicht manuell Hex fuer Hex durchfuehren muss.

**Scope (siehe [Travel-System.md](../features/Travel-System.md)):**
- [ ] Travel-Loop Mechanismus (setTimeout-basiert)
- [ ] Segment-fuer-Segment Bewegung nach `startTravel()`
- [ ] Zeit-Integration via `time:advance-requested` pro Segment
- [ ] Encounter-Checks am Stunden-Anfang (12.5% Basis-Chance)
- [ ] Auto-Pause bei Encounter
- [ ] Pause/Resume funktioniert mit Travel-Loop
- [ ] Cancel stoppt Travel-Loop

**Implementierungs-Fortschritt:**

| Komponente | Status | Anmerkung |
|------------|--------|-----------|
| types.ts | ⬜ | TravelState erweitern (hourProgress, totalHoursTraveled) |
| travel-store.ts | ⬜ | Stunden-Tracking Methoden |
| travel-service.ts | ⬜ | Travel-Loop, Encounter-Check, SM-Integration |

**Nicht im Scope:**
- Token-Animation auf Map (smooth movement)
- Route-Preview mit ETA vor Start
- Wegpunkt Drag&Drop
- UI Progress-Anzeige (12.4 / 48 mi)

---

## 🎯 Nächste Phasen

| Option | Scope |
|--------|-------|
| **Loot-System** | Budget-Tracking, Creature-defaultLoot, Hoards → [Loot-Feature.md](../features/Loot-Feature.md) |
| **Cartographer** | Map-Editor zum Erstellen eigener Maps |
| **Audio-Feature** | Context-basierte Soundscapes (Terrain, Weather, Time) |
| **Encounter-Feature** | Volle Encounter-Kontext-Nutzung, Typ-Variation, mehrere Kreaturen |

---

## Backlog

### Offen (⬜)

| Bereich | Aspekt | Referenz |
|---------|--------|----------|
| Travel | Animation (Token-Bewegung) | [Travel-System.md](../features/Travel-System.md) |
| Travel | Route-Preview mit ETA | [Travel-System.md](../features/Travel-System.md) |
| Travel | Wegpunkt Drag&Drop | [Travel-System.md](../features/Travel-System.md) |
| Weather | Weather-Events (Blizzard etc.) | [Weather-System.md](../features/Weather-System.md) |
| Weather | GM Override | [Weather-System.md](../features/Weather-System.md) |
| Weather | UI-Anzeige | [Weather-System.md](../features/Weather-System.md) |
| Encounter | Weather im Context | [Encounter-System.md](../features/Encounter-System.md) |
| Encounter | Faction-Territory Population | [Encounter-System.md](../features/Encounter-System.md) |
| Combat | Death Saves UI | [Combat-System.md](../features/Combat-System.md) |
| Quest | Quest-Editor | [Quest-System.md](../features/Quest-System.md) |
| Party | XP-Verteilung System | [Character-System.md](../features/Character-System.md) |
| Party | Character-UI | [Character-System.md](../features/Character-System.md) |
| Inventory | Equipped-Items (AC/Damage) | [Inventory-System.md](../features/Inventory-System.md) |
| Inventory | Inventory-UI | [Inventory-System.md](../features/Inventory-System.md) |
| Inventory | Automatischer Rationen-Abzug | [Inventory-System.md](../features/Inventory-System.md) |
| Map | Multi-Map-Navigation | [Map-Feature.md](../features/Map-Feature.md) |
| Map | Cartographer (Editor) | [Cartographer.md](../application/Cartographer.md) |
| UI | Debug-Panel | [SessionRunner.md](../application/SessionRunner.md) |
| UI | Transport-Wechsel UI | [SessionRunner.md](../application/SessionRunner.md) |
| UI | Audio Quick-Controls | [SessionRunner.md](../application/SessionRunner.md) |
| Time | Calendar-Wechsel | [Time-System.md](../features/Time-System.md) |
| Events | Siehe Status-Spalten | [Events-Catalog.md](Events-Catalog.md) |

### Bewusst ausgelassen (🚫)

| Bereich | Aspekt | Grund |
|---------|--------|-------|
| Travel | A* Pathfinding | Greedy reicht fuer MVP |
| Encounter | Multi-Gruppen-Encounters | Komplexitaet |
| Combat | Grid-Positioning | Theater of the Mind |
| Combat | Legendary/Lair Actions | Komplexitaet |
| Quest | Reputation-Rewards | Komplexitaet |
| Quest | Hidden Objectives | Komplexitaet |
| Loot | Hoard-System | Komplexitaet |
| Loot | Budget-Tracking ueber Zeit | Komplexitaet |
| Loot | GM-Override | Post-MVP |
| Loot | Loot-UI | Post-MVP (nur Service-Layer) |
| Loot | Creature defaultLoot | Komplexitaet |

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
