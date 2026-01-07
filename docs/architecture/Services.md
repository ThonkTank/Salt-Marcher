# Services (Pipeline-Pattern)

Services sind **stateless Pipelines**, die von Workflows aufgerufen werden. Sie empfangen einen Context und liefern ein Ergebnis zurueck.

---

## Kernprinzip

```
Workflow
    │
    ├── liest State aus sessionState
    ├── holt Daten aus Vault
    │
    ↓
Service.execute(context) → Result<Output, Error>
    │
    ├── reine Funktion: Input → Output
    └── darf Vault lesen/schreiben
```

---

## Inline-Typen

Services definieren ihre Parameter inline. Keine separaten Type-Dateien fuer Service-interne Daten.

### Prinzip

**Services definieren inline, Workflows uebergeben inline.**

- Service-Funktionen definieren ihre Input-Parameter inline in der Signatur
- Keine separaten Type-Dateien fuer Service-interne Daten (SeedSelection, FlavouredGroup, etc.)
- Nur persistierte Outputs (wie EncounterInstance) bekommen ein Schema in `src/types/`
- Workflows bauen den Kontext inline und uebergeben ihn direkt
- **Existierende Konstanten wiederverwenden:** Typen aus `src/constants/` (z.B. `FactionStatus`, `CreatureSize`) importieren statt inline duplizieren

### Beispiel

```typescript
// Service definiert inline
export function selectSeed(context: {
  terrain: { id: string; threat: number };
  timeSegment: string;
  factions: { factionId: string; weight: number }[];
  exclude?: string[];
}): { creatureId: string; factionId: string | null } | null {
  // Implementierung
}

// Workflow uebergibt inline
const seed = selectSeed({
  terrain: state.terrain,
  timeSegment: state.time.daySegment,
  factions: tile.factionPresence,
});
```

### Vorteile

| Aspekt | Inline-Typen | Separate Type-Dateien |
|--------|--------------|----------------------|
| Wartung | Typ neben Logik | Typ in separater Datei |
| Lesbarkeit | Signatur zeigt Erwartungen | Muss Type-Datei oeffnen |
| Refactoring | Aenderung an einer Stelle | Typ + Implementierung aendern |
| Kopplung | Locker | Eng (gemeinsamer Typ) |

---

## Regeln

### Erlaubt

| Aktion | Beispiel |
|--------|----------|
| Input konsumieren | `generate(context: EncounterContext)` |
| Output liefern | `→ Result<EncounterInstance, Error>` |
| Vault lesen | Creature-Definitionen laden und filtern |
| Vault schreiben | Journal-Eintrag speichern |
| Andere Services in Pipeline aufrufen | Encounter ruft NPC-Generator auf |

### Verboten

| Aktion | Grund |
|--------|-------|
| Queries an andere Services | Workflow liefert alle Kontext-Daten |
| Eigene Entscheidungen treffen | Workflow entscheidet |
| Eigenen State halten | sessionState = Single Source of Truth |
| Events emittieren | Kein EventBus |
| Auf Events subscriben | Kein EventBus |

---

## Service-Interface

Alle Services folgen diesem Pattern:

```typescript
interface Service<TContext, TOutput, TError> {
  execute(context: TContext): Result<TOutput, TError>;
}
```

### Beispiel: EncounterService

```typescript
interface EncounterService {
  generate(context: EncounterContext): Result<EncounterInstance, EncounterError>;
}

// Context enthaelt Kontext-Daten, KEINE vorgefilterten Listen
interface EncounterContext {
  position: HexCoordinate;
  terrain: TerrainDefinition;
  timeSegment: TimeSegment;
  weather: Weather;
  factions: FactionPresence[];
  trigger: EncounterTrigger;
  // KEIN eligibleCreatures - Service filtert selbst via Vault
}
```

Der Workflow baut den Context und ruft den Service:

```typescript
// encounterWorkflow.ts
import { getState, updateState } from './sessionState';
import { generateEncounter } from '@services/encounterGenerator';
import { vault } from '@infrastructure/vault';

export function checkEncounter(trigger: EncounterTrigger): void {
  if (!rollEncounterCheck()) return;

  const state = getState();
  const map = vault.getEntity('map', state.activeMapId!);
  const tile = map.getTile(state.party.position);

  const result = generateEncounter({
    position: state.party.position,
    terrain: vault.getEntity('terrain', tile.terrainId),
    timeSegment: state.time.daySegment,
    weather: state.weather!,
    factions: tile.factionPresence ?? [],
    trigger,
  });

  if (isOk(result)) {
    updateState(s => ({
      ...s,
      encounter: { status: 'preview', current: unwrap(result) }
    }));
  }
}
```

---

## Services filtern selbst

Wenn ein Service Filterkriterien aus dem Context ableiten kann, fuehrt er die Filterung selbst durch:

```typescript
// ✅ RICHTIG - Service filtert via Vault
function generateEncounter(context: EncounterContext): Result<EncounterInstance, Error> {
  // Service laedt und filtert Creatures selbst
  const allCreatures = vault.getAllEntities('creature');
  const eligible = allCreatures
    .filter(c => c.terrains.includes(context.terrain.id))
    .filter(c => isActiveAtTime(c, context.timeSegment));

  // Weiter mit eligible...
}

// ❌ FALSCH - Caller uebergibt vorgefilterte Liste
function generateEncounter(context: { eligibleCreatures: Creature[] }) {
  // Service bekommt fertige Liste - wer hat gefiltert? Nach welchen Kriterien?
}
```

**Regel:** Der Caller uebergibt **keine vorgefilterten Listen**. Services haben Vault-Zugriff und filtern selbst.

---

## Pipeline-Aufrufe zwischen Services

Services duerfen andere Services aufrufen, aber **nur als Teil einer festen Pipeline**:

```
EncounterService.generate()
        │
        ├── NPCService.generate()     ← Lead-NPC erstellen
        │
        └── LootService.generate()    ← Loot generieren
```

### Erlaubt: Feste Pipeline

```typescript
function generateEncounter(context: EncounterContext): Result<EncounterInstance, Error> {
  // 1. Gruppen erstellen
  const groups = createGroups(context);

  // 2. Lead-NPC generieren (Teil der Pipeline)
  if (needsLeadNPC(groups)) {
    const npc = generateNPC({
      faction: context.factions[0],
      culture: context.factions[0].culture,
      role: 'leader',
      creatureBase: groups[0].leader
    });
    groups[0].leadNPC = npc;
  }

  // 3. Loot generieren (Teil der Pipeline)
  const loot = generateLoot({
    creatures: groups.flatMap(g => g.creatures),
    partyLevel: context.party.level
  });

  return ok({ groups, loot, ... });
}
```

### Verboten: Dynamische Queries

```typescript
// FALSCH - Service fragt anderen Service nach Informationen
function generateEncounter(context: EncounterContext) {
  // ❌ VERBOTEN: Query an anderen Service
  const weather = weatherService.getCurrentWeather();
  const time = timeService.getCurrentTime();

  // Das ist falsch! Workflow muss alle Daten im Context liefern.
}
```

---

## Vault-Zugriff

Services duerfen den Vault lesen und schreiben:

### Lesen (Entities laden und filtern)

```typescript
function generateEncounter(context: EncounterContext) {
  // ✅ Creature-Definitionen aus Vault laden und filtern
  const creatures = vault.getAllEntities('creature')
    .filter(c => c.terrains.includes(context.terrain.id));
}
```

### Schreiben (Ergebnisse persistieren)

```typescript
function createJournalEntry(context: JournalContext): Result<JournalEntry, Error> {
  const entry = buildEntry(context);

  // ✅ Journal-Eintrag in Vault speichern
  vault.saveEntity('journal', entry);

  return ok(entry);
}
```

---

## Verfuegbare Services

| Service | Input | Output | Vault-Zugriff |
|---------|-------|--------|---------------|
| EncounterService | EncounterContext | EncounterInstance | Lesen (Creatures) |
| NPCService | NPCContext | NPCDefinition | Lesen/Schreiben |
| LootService | LootContext | GeneratedLoot | Lesen (Items) |
| WeatherService | WeatherInput | Weather | - |
| JournalService | JournalContext | JournalEntry | Schreiben |
| gridSpace | GridConfig, Combatants | GridConfig, Positions | - |
| combatTracking | Party, Groups, Actions | SimulationState, AttackResolution | Lesen (Creatures) |
| combatantAI | CombatProfile, SimulationState | ActionTargetScore, TurnAction[] | - |
| EncounterGenerator/difficulty | EncounterGroup[], PartyInput | SimulationResult, DifficultyLabel | Lesen (Creatures) |

---

## Service-Dokumentation

Jeder Service hat eine eigene Dokumentation unter `docs/services/`:

- [encounter/](../services/encounter/) - Encounter-Pipeline
- [gridSpace.md](../services/gridSpace.md) - Grid-State und Positioning
- [combatTracking.md](../services/combatTracking.md) - Combat State-Management + Resolution
- [combatantAI/](../services/combatantAI/) - Combat-AI
  - [combatantAI.md](../services/combatantAI/combatantAI.md) - AI-Entscheidungslogik
- [NPCs/](../services/NPCs/) - NPC-Generierung und Matching
- [Weather.md](../services/Weather.md) - Wetter-Generierung
- [Loot.md](../services/Loot.md) - Loot-Generierung

---

## Anti-Patterns

### 1. Service haelt State

```typescript
// ❌ FALSCH
class WeatherService {
  private currentWeather: Weather;  // State im Service!

  getCurrentWeather() {
    return this.currentWeather;
  }
}

// ✅ RICHTIG
function generateWeather(input: WeatherInput): Weather {
  // Pure function, kein interner State
}
```

### 2. Service entscheidet ueber Workflow

```typescript
// ❌ FALSCH
function generateEncounter(context) {
  const encounter = build(context);

  if (encounter.isDeadly) {
    startCombat(encounter);  // Service startet Workflow!
  }
}

// ✅ RICHTIG
function generateEncounter(context): Result<EncounterInstance, Error> {
  return ok(build(context));
  // Workflow entscheidet, was mit dem Ergebnis passiert
}
```

### 3. Service kommuniziert via Events

```typescript
// ❌ FALSCH
function generateEncounter(context) {
  const encounter = build(context);
  eventBus.publish('encounter:generated', encounter);  // Events!
}

// ✅ RICHTIG
function generateEncounter(context): Result<EncounterInstance, Error> {
  return ok(build(context));
  // Kein EventBus, nur Return-Value
}
```

### 4. Caller uebergibt vorgefilterte Listen

```typescript
// ❌ FALSCH
generateEncounter({
  eligibleCreatures: getEligibleCreatures(),  // Wer filtert? Wo ist die Logik?
});

// ✅ RICHTIG
generateEncounter({
  terrain: terrain,
  timeSegment: timeSegment,
  // Service filtert Creatures selbst basierend auf terrain + timeSegment
});
```
