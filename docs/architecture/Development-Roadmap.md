# Development Roadmap

> **Wird benoetigt von:** Aktueller Task

Implementierungsstrategie und aktueller Status für Salt Marcher.

---

## Phase-Übersicht

| # | Phase | Status | Scope |
|---|-------|--------|-------|
| 1 | Core | ✅ | Result, EventBus (inkl. request()), Schemas, Hex-Math (136 Tests) |
| 2 | Travel-Minimal | ✅ | Party-Bewegung auf Hex-Map mit Zeit und Persistenz |
| 2.5 | EventBus-Integration | ✅ | Cross-Feature-Kommunikation via EventBus |
| 3 | Weather-System | ✅ | Terrain-basiertes Wetter, Travel-Speed-Modifier |
| 4a | Entity-Schemas | ✅ | Creature, NPC, Faction Schemas + Presets |
| 4b | Encounter-Core | ✅ | Generierung, State-Machine, 4 Typen (combat/social/passing/trace) |
| 4c | Travel-Integration | ✅ | Encounter-Checks während Reisen (12.5%/h) |
| 5 | Combat-Feature | ✅ | Initiative-Tracker, HP-Management, Conditions, Encounter-Integration |
| 6 | Frontend-Refactoring | ✅ | SessionRunner Layout (Header+Sidebar+Map), DetailView (Encounter+Combat Tabs) |
| 7 | Blocker-Sprint | ✅ | Character-Schema, Party Members, Combat XP, Travel State-Machine |

---

## ✅ Abgeschlossene Phasen

### Phase 1: Core

**Scope:** Basis-Infrastruktur für alle Features
**Geliefert:** Result/Option Types, EventBus mit request(), Zod-Schemas, Hex-Math Utils
**Tests:** 136 Unit-Tests

### Phase 2 + 2.5: Travel-Minimal + EventBus-Integration

**Scope:** Nachbar-Hex-Bewegung, Zeit-Fortschritt, EventBus für load/state-changed Events

**Geliefert:**
- Features: Map, Party, Time, Travel (Nachbar-Bewegung)
- Infrastructure: Vault-Adapter (Map, Party, Time, Calendar), Settings-Service
- Application: SessionRunner mit Canvas, NotificationService
- EventBus: request() Pattern, Handler für map/party/time/travel

**Nicht im Scope:** Full Travel Workflow (State-Machine, Routing), Member-Management, Multi-Map-Navigation

→ Event-Status: [Events-Catalog.md](Events-Catalog.md) (siehe Status-Spalten)

### Phase 3: Weather-System

**Scope:** Terrain-basiertes Wetter mit Travel-Integration

**Geliefert:**
- Weather Feature: Store, Service, Utils (Area-Averaging, Transitions)
- Schemas: WeatherRange, WeatherParams, WeatherState, Temperature/Wind/Precipitation-Kategorien
- Terrain: weatherRanges für alle 8 Terrains (road, plains, forest, hills, mountains, swamp, desert, water)
- Map: currentWeather Property für Persistenz
- Travel: Weather-Speed-Faktor in Reisezeit-Berechnung
- Events: time:segment-changed → Weather → environment:weather-changed

**Nicht im Scope:** Weather-Events (Blizzard, Thunderstorm), Audio-Integration, GM Override, UI-Anzeige

### Phase 4a: Entity-Schemas

**Scope:** Zod-Schemas für Creature, NPC, Faction als Voraussetzung für Encounter-Feature

**Geliefert:**
- Schemas: CreatureDefinition, NPC, Faction (mit eingebetteter CultureData)
- Sub-Schemas: AbilityScores, SpeedBlock, PersonalityTraits, WeightedTrait/Quirk
- Presets: 8 Basis-Kreaturen, 8 Basis-Fraktionen mit Kultur-Hierarchie
- EntityType erweitert um 'poi'

**Nicht im Scope:** Registry-Interfaces (→ 4b), Vault-Persistierung (→ Library), Culture-Generatoren

### Phase 4b: Encounter-Core

**Scope:** Encounter-Generierung und State-Management

**Geliefert:**
- Schemas: EncounterDefinition, EncounterInstance, EncounterContext, CreatureSlot (3 Varianten)
- Events: 9 Encounter-Events (generate/start/dismiss/resolve requested + generated/started/dismissed/resolved + state-changed)
- Feature: Store, Service, Types nach Service+Store Pattern
- 5-Step Pipeline: Tile-Eligibility → Kreatur-Auswahl → Typ-Ableitung → Variety-Validation → Encounter-Befüllung
- NPC-Generator: Culture-Inheritance, Name/Personality-Generierung, NPC-Reuse-Logik
- State-Machine: pending → active → resolved
- XP-Berechnung: CR-zu-XP Tabelle nach D&D 5e

**Nicht im Scope:** Travel-Integration (Phase 4c), Combat-Feature, 40/60 XP-Split (Quest), Multi-Gruppen-Encounters

### Phase 4c: Travel-Integration

**Scope:** Encounter-Checks während Reisen

**Geliefert:**
- encounter-chance.ts: calculateEncounterChance(), rollEncounter(), Population-Faktoren
- Encounter-Service subscribed zu travel:position-changed
- 12.5% Basis-Chance × Reisezeit × Population-Faktor
- TravelPositionChangedPayload Export

**MVP-Vereinfachungen:** Proportionale Chance (statt Hour-Boundary), Default-Population 50

**Nicht im Scope:** travel:paused State-Machine, SessionRunner UI, Faction-Territory Population

### Phase 5: Combat-Feature

**Scope:** Initiative-Tracking, HP-Management, D&D 5e Conditions

**Geliefert:**
- Schemas: CombatState, CombatParticipant, Condition (14 D&D 5e), CombatEffect
- Events: 24 Combat-Events (start/end/damage/heal/condition/turn/concentration)
- Feature: Store, Service, Utils (CR→XP, Concentration DC, Participant-Factory)
- Integration: Encounter→Combat (auto-start), Combat→Time (6s × Runden)
- UI: Combat-Panel mit Initiative-Liste, HP-Bars, Condition-Badges

**Nicht im Scope:** Grid-Positioning, Legendary/Lair Actions, Reaction-Tracking, Death Saves UI

### Phase 6: Frontend-Refactoring

**Scope:** SessionRunner Layout nach Dokumentation, DetailView für Encounter/Combat

**Geliefert:**
- SessionRunner: CSS Grid Layout (Header + Sidebar + Map), Time-Advance, Weather-Summary
- DetailView: Tab-Navigation, Encounter-Tab (Preview + Actions), Combat-Tab (migriert)
- Auto-Open bei encounter:generated und combat:started Events
- Gelöscht: combat-panel.ts, controls.ts (ersetzt durch header.ts + sidebar.ts)

**Nicht im Scope:** Debug-Panel, Audio/Party Quick-Controls (nur Platzhalter), Travel State-Machine

### Phase 7: Blocker-Sprint

**Scope:** Kritische Lücken beheben, bevor Quest-System implementiert wird

**Geliefert:**
- **Character-Schema:** Neues `characterSchema` (level, hp, ac, speed, strength), Party-Member-Management
- **Party-Feature:** `getMembers()`, `getPartyLevel()`, `getPartySpeed()`, `addMember()`, `removeMember()`
- **Encounter:** `getPartyLevel()` nutzt jetzt echte Character-Daten statt hardcoded `return 1`
- **Combat XP:** `endCombat()` berechnet XP aus besiegten Creatures (CR→XP Tabelle)
- **Travel State-Machine:** `idle → planning → traveling ↔ paused → arrived`
- **Pathfinding:** Greedy Neighbor-Selection für Multi-Hex-Routen
- **Presets:** Demo-Characters (Thorin, Elara, Brynn, Sera - Level 5 Party)

**Nicht im Scope:** Inventory-System, Encumbrance, 40/60 XP-Split (→ Quest), Travel-Animation, A* Pathfinding

---

## 🔄 Aktiver Sprint

**Feature:** —

**User Story:** —

**Scope:**
- [ ] ...

**Nicht im Scope:**
- ❌ ...

**Akzeptanzkriterien:**
- [ ] ...

**Fokus-Dateien:**
- ...

---

## 🎯 Nächste Phasen

| Option | Scope |
|--------|-------|
| **Cartographer** | Map-Editor zum Erstellen eigener Maps |
| **Travel-Vollständig** | State-Machine, Routing, Pause/Resume |
| **Quest-System** | 40/60 XP-Split, Objectives, Loot |

---

## Backlog (bekannte Lücken)

| Bereich | Offen | Referenz |
|---------|-------|----------|
| Encounter | EncounterContext erweitern (tile statt position+terrainId), FactionPresence im Context, **Weather im GenerationContext wird ignoriert** (encounter-service.ts:623) | [Encounter-System.md](../features/Encounter-System.md) |
| Travel | Animation, UI für Routen-Vorschau | [Travel-System.md](../features/Travel-System.md) |
| Weather | Weather-Events, GM Override, UI-Anzeige | [Weather-System.md](../features/Weather-System.md) |
| Time | Calendar-Wechsel, EntityRegistry-Integration | [Time-System.md](../features/Time-System.md) |
| Party | XP-System (Party-Level-Verteilung), Character-UI im Party-Manager | [Character-System.md](../features/Character-System.md) |
| Map | Multi-Map-Navigation, Cartographer | [Map-Feature.md](../features/Map-Feature.md) |
| UI | Transport-Wechsel, Debug-Panel | [SessionRunner.md](../application/SessionRunner.md) |
| Events | Siehe Status-Spalten | [Events-Catalog.md](Events-Catalog.md) |

---

## Projekt-Kontext

### Vault-Struktur

```
Vault/
└── SaltMarcher/              # Konfigurierbar in Settings
    ├── maps/
    │   └── {mapId}.json      # OverworldMap
    ├── parties/
    │   └── {partyId}.json    # Party
    ├── time/
    │   └── state.json        # TimeState (currentTime, calendarId)
    └── almanac/
        └── {calendarId}.json # CalendarDefinition
```

### Test-Strategie

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

1. **Phase komprimieren:**
   - Details auf 3-5 Zeilen Summary reduzieren
   - Format: Scope (was war geplant) + Geliefert (was wurde implementiert)
   - Verweis auf relevante Docs für Details

2. **Event-Status aktualisieren:**
   - Events-Catalog.md → Status-Spalte auf ✅ setzen
   - "Seit"-Spalte mit Phase-Nummer füllen

3. **Backlog pflegen:**
   - Implementierte Items aus Backlog entfernen
   - Neue entdeckte Lücken hinzufügen
   - Referenz-Links prüfen

### Beim planen neuer Phase

1. Phase zur Übersichts-Tabelle hinzufügen (Status: 🔄)
2. "Aktueller Fokus" Sektion aktualisieren mit:
   - User Story
   - Scope-Definition (was ist drin, was nicht)
   - Implementierungs-Tabelle (während der Arbeit)

### Prinzipien

| Dokument | Enthält |
|----------|---------|
| **Roadmap** | Phasen-Übersicht + aktueller Fokus + Backlog |
| **Events-Catalog.md** | Event-Definitionen + Implementierungs-Status |
| **Feature-Docs** | Spezifikation (Ziel-Zustand) |

Keine Details in abgeschlossenen Phasen wiederholen.

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
