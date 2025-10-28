# Roadmap-Bestandsaufnahme & Priorisierung
**Erstellt:** 2025-10-28
**Status:** Phase 2.7 ✅ Abgeschlossen

## 📊 Aktueller Stand

### Completed Phases ✅

| Phase | Status | Completion | Key Deliverables |
|-------|--------|------------|------------------|
| **Phase 0** | ✅ Complete | 100% | Tags, Schemas, Samples, Validators |
| **Phase 2.1** | ✅ Complete | 100% | Faction Territory Marking (Cartographer Brush + Inspector) |
| **Phase 2.2** | ✅ Complete | ~90% | Faction Context in Sessions (Event Flow) |
| **Phase 2.4** | ✅ Complete | 100% | Encounter Composition MVP (Creature Selection + XP Calc) |
| **Phase 2.7** | ✅ Complete | 100% | **HP & Initiative Tracking** (Combat spielbar!) |

### In-Progress Phases ⚙️

| Phase | Status | Completion | Blocker/Next Steps |
|-------|--------|------------|-------------------|
| **Phase 1** | ⚙️ In Progress | 75% | 14 Test failures (brauchen Obsidian-API-Mocks), Library-Repos migrieren |

### Planned Phases ⏳

| Phase | Priority | Dependencies | User Value |
|-------|----------|--------------|------------|
| **Phase 2.6** | 🔴 Kritisch | Phase 2.7 ✅ | Random Encounter Generation - Automatisiert Encounter-Komposition |
| **Phase 2.5** | 🟢 Nice-to-have | Phase 2.4 ✅ | Faction-based Creature Filtering - QoL für manuelle Komposition |
| **Phase 2.3** | ⚡ Future | Phase 3 | Member Management (Subfraktionen, NPCs, Jobs) |
| **Phase 3** | 🟡 Important | Phase 2 Complete | Orte & Dungeons (Neuer Vertical Slice!) |
| **Phase 4** | ⏳ Later | Phase 3 | Event Engine & Automation |
| **Phase 5** | ⏳ Later | Phase 4 | Calculator & Loot Services |
| **Phase 6** | ⏳ Release | Phase 5 | Audio & Experience Layer |

## 🎯 Vertical Slice Analysis

### Encounter Vertical Slice (Phase 2)

**Ziel:** GM kann Encounters von Start bis Ende durchspielen.

**Status:** 🟡 Basis-Slice KOMPLETT, Automatisierung ausstehend

**Completed Steps:**
1. ✅ **Phase 2.1:** Fraktionen auf Karte zuweisen
2. ✅ **Phase 2.2:** Faction-Kontext zu Encounters
3. ✅ **Phase 2.4:** Creature Composition (manuell)
4. ✅ **Phase 2.7:** HP & Initiative Tracking

**Workflow funktioniert END-TO-END:**
```
Travel → Encounter Event (mit Faction) → Creatures hinzufügen → XP berechnen
→ Start Combat → Initiative eingeben → HP tracken → Defeated markieren → Resolve
```

**Remaining für vollständigen Vertical Slice:**
- 🔴 **Phase 2.6:** Random Encounter Generation (Automatisierung)
- 🟢 **Phase 2.5:** Faction Filtering (QoL, optional)

### Orte & Dungeons Vertical Slice (Phase 3)

**Ziel:** GM kann Orte hierarchisch verwalten und Dungeons mit Grid-Karte spielen.

**Status:** ⏳ Noch nicht gestartet

**Dependencies:**
- KEINE technischen Dependencies zu Phase 2
- Kann theoretisch parallel entwickelt werden
- ABER: Vertical Slice Principle sagt "finish one slice before starting another"

## 🔍 Critical Path Analysis

### Option A: Complete Encounter Slice FIRST (Empfohlen nach Vertical Slice Principle)

```
1. Phase 1 finalisieren (Test-Suite + Library-Repos)     [~3-4 Tage]
   ├─ 14 Test failures beheben (Obsidian-API-Mocks)
   ├─ Library-Repos auf Store-Pattern migrieren
   └─ Seed-System für reproduzierbare Tests

2. Phase 2.6 - Random Encounter Generation               [~4-5 Tage]
   ├─ Generator-Logic (Faction/Terrain/Region → Creatures)
   ├─ CR Budget Calculation (Party Level → Difficulty)
   ├─ Tag-based Creature Selection
   └─ Integration in Session Runner

3. [OPTIONAL] Phase 2.5 - Faction Filtering              [~1-2 Tage]
   ├─ Faction-Filter-Dropdown in Creature List
   └─ Relevance-Scoring (Exact > Partial > No match)

4. Phase 3 - Orte & Dungeons                             [~10-14 Tage]
   └─ Neuer Vertical Slice
```

**Vorteile:**
- ✅ Encounter-System vollständig fertig
- ✅ Entspricht Vertical Slice Principle
- ✅ Jeder Step liefert User-Value
- ✅ Foundation (Phase 1) ist stabil

**Nachteile:**
- ❌ Phase 3 wartet länger

### Option B: Start Phase 3 immediately

```
1. Phase 3 - Orte & Dungeons                             [~10-14 Tage]
   └─ Neuer Feature-Bereich

2. Später: Phase 2.6 + 2.5
```

**Vorteile:**
- ✅ Schneller neue Features (Orte & Dungeons)
- ✅ Parallele Entwicklung möglich

**Nachteile:**
- ❌ Encounter Vertical Slice bleibt unvollständig
- ❌ Phase 1 Foundation-Tasks bleiben offen
- ❌ Widerspricht Vertical Slice Principle
- ❌ Random Encounters fehlen (User muss alles manuell machen)

## 🎯 Empfohlene Priorisierung

### **KRITISCH 🔴 - Nächste 2 Wochen**

#### 1. Phase 1 - Foundation abschließen [~3-4 Tage]

**Rationale:** Foundation muss stabil sein. 14 Test failures blockieren produktiven Workflow.

**Tasks:**
- [ ] **Test-Suite reparieren** (14 failures → 0)
  - Obsidian-API-Mocks implementieren (`app.vault`, `registerEvent`, `SVG`)
  - Vitest Mock-Layer erstellen
  - Integration-Tests auf neue Mocks umstellen
- [ ] **Library-Repos migrieren**
  - `creature-repository.ts`, `spell-repository.ts`, `item-repository.ts`, `equipment-repository.ts`
  - Auf PersistentStore-Pattern umstellen
  - Konsistent mit `terrain-repository.ts` und `region-repository.ts`
- [ ] **Seed-System implementieren**
  - `devkit seed --preset default` für reproduzierbare Tests
  - Seed-Vaults in `devkit/testing/seeds/`
  - CLI-Integration

**DoD:**
- [ ] Alle Tests grün (0 failures)
- [ ] Library-Repos nutzen PersistentStores
- [ ] Seed-System funktioniert (`devkit seed --preset default`)

#### 2. Phase 2.6 - Random Encounter Generation [~4-5 Tage]

**Rationale:** Komplettiert Encounter Vertical Slice. Automatisiert was in Phase 2.7 spielbar gemacht wurde.

**Tasks:**
- [ ] **Generator-Logic** (`src/workmodes/encounter/generator.ts`)
  - Input: Faction, Terrain, Region, Party Level
  - Output: `EncounterCreature[]` mit Count basierend auf CR Budget
- [ ] **Tag-based Creature Selection**
  - Creature-Library filtern nach Faction/Terrain-Tags
  - Scoring: Exact match > Partial match > No match
  - Fallback: Generische Creatures wenn keine passenden gefunden
- [ ] **CR Budget Calculation**
  - Party Level → Target XP (Easy/Medium/Hard/Deadly)
  - CR-Kombinationen finden die Target XP treffen
  - Varianz für Überraschung (±20%)
- [ ] **Session Runner Integration**
  - "Generate Random Encounter" Button
  - Generator nutzt Faction vom aktuellen Hex
  - Generierte Creatures landen direkt in Composition

**DoD:**
- [ ] User kann "Generate Random Encounter" klicken
- [ ] Generator berücksichtigt Faction/Terrain/Region
- [ ] Generierte Encounters sind balanciert (CR Budget stimmt)
- [ ] Build erfolgreich, Tests grün

### **OPTIONAL 🟢 - Wenn Zeit bleibt**

#### 3. Phase 2.5 - Faction-based Creature Filtering [~1-2 Tage]

**Rationale:** QoL für manuelle Encounter-Komposition. Nicht kritisch da Random Generator bereits filtert.

**Tasks:**
- [ ] Faction-Filter-Dropdown in Creature List
- [ ] Relevance-Indicator neben Creatures
- [ ] Filter-Logic: `filterCreaturesByFaction(creatures, factionTags)`

**DoD:**
- [ ] User kann Creature-Liste nach Faction filtern
- [ ] Relevance-Scoring funktioniert (Exact > Partial > No match)

### **SPÄTER ⏳ - Nach Phase 2 Completion**

#### 4. Phase 3 - Orte & Dungeons [~10-14 Tage]

**Rationale:** Neuer Vertical Slice. Erst starten wenn Phase 2 vollständig ist.

**Kickoff-Checkliste:**
- [ ] Phase 2 DoD komplett erfüllt (inkl. 2.6)
- [ ] E2E-Test läuft grün (Travel → Encounter → Combat)
- [ ] Dokumentation aktualisiert
- [ ] Schema & Samples für `Orte/` finalisiert

## 📋 Nächste Schritte (Konkret)

### Diese Woche (KW 46)

**Montag-Dienstag:**
- [ ] Test-Suite reparieren (Obsidian-API-Mocks)
- [ ] Erste Library-Repo migrieren (creature-repository.ts)

**Mittwoch-Donnerstag:**
- [ ] Restliche Library-Repos migrieren
- [ ] Seed-System implementieren

**Freitag:**
- [ ] Phase 2.6 Design-Doc schreiben
- [ ] Generator-Logic Prototype

### Nächste Woche (KW 47)

**Montag-Mittwoch:**
- [ ] Phase 2.6 Implementation (Generator + Integration)

**Donnerstag-Freitag:**
- [ ] Tests & Smoke Tests
- [ ] Dokumentation
- [ ] [OPTIONAL] Phase 2.5 starten

## ✅ Alignment mit Zielen & Arbeitsweisen

### ✅ Vertical Slice Principle
- Encounter Slice wird VOLLSTÄNDIG fertiggestellt (2.1 → 2.2 → 2.4 → 2.7 → 2.6)
- Erst dann neuer Slice (Phase 3)

### ✅ Simple > Clever
- Foundation erst stable machen (Test-Suite)
- Dann Features auf stabiler Basis

### ✅ DRY
- Library-Repos Migrations nutzt bestehendes Store-Pattern
- Random Generator nutzt bestehende Tag-Filter-Logic

### ✅ User-Value First
- Jeder Step liefert direkten Value
- Phase 2.6 automatisiert was User jetzt manuell machen muss

### ✅ Testing Philosophy
- Test-Suite MUSS grün sein bevor wir weitermachen
- Seed-System ermöglicht reproduzierbare Tests

## 🎯 Fazit & Empfehlung

**EMPFEHLUNG: Option A - Complete Encounter Slice FIRST**

**Begründung:**
1. **Foundation first:** Test-Suite muss grün sein (14 failures blockieren)
2. **Vertical Slice Principle:** Encounter Slice KOMPLETT fertigstellen
3. **User Value:** Random Generation automatisiert was jetzt manuell ist
4. **Code Quality:** Stable Foundation für Phase 3

**Timeline:**
- Phase 1: ~3-4 Tage
- Phase 2.6: ~4-5 Tage
- **Total: ~1.5-2 Wochen bis Encounter Slice complete**
- Dann: Phase 3 mit stabilem Foundation

**Alternative:**
Falls du UNBEDINGT Phase 3 sofort willst, können wir das machen. ABER:
- Test-Suite bleibt broken (14 failures)
- Encounter Slice bleibt incomplete (kein Random Generation)
- Widerspricht Vertical Slice Principle

**Was möchtest du?**
