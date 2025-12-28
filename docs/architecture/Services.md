# Services (Pipeline-Pattern)

Services sind **stateless Pipelines**, die vom SessionControl aufgerufen werden. Sie empfangen einen vollständigen Context und liefern ein Ergebnis zurück.

---

## Kernprinzip

```
SessionControl (State Owner)
        │
        ├── sammelt Context aus eigenem State
        │
        ↓
Service.execute(context) → Result<Output, Error>
        │
        └── reine Funktion: Input → Output
```

---

## Regeln

### Erlaubt

| Aktion | Beispiel |
|--------|----------|
| Input konsumieren | `generate(context: EncounterContext)` |
| Output liefern | `→ Result<EncounterInstance, Error>` |
| Vault lesen | Creature-Definition aus Vault laden |
| Vault schreiben | Journal-Eintrag speichern |
| Andere Services in Pipeline aufrufen | Encounter ruft NPC-Generator auf |

### Verboten

| Aktion | Grund |
|--------|-------|
| Queries an andere Services | SessionControl liefert alle Daten |
| Eigene Entscheidungen treffen | SessionControl entscheidet |
| Eigenen State halten | SessionControl = Single Source of Truth |
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

// Context enthält ALLE benötigten Daten
interface EncounterContext {
  position: HexCoordinate;
  terrain: TerrainDefinition;
  timeSegment: TimeSegment;
  weather: Weather;
  party: PartySnapshot;
  factions: FactionPresence[];
  eligibleCreatures: CreatureDefinition[];
  trigger: EncounterTrigger;
}
```

Der SessionControl baut den Context zusammen:

```typescript
// SessionControl
async checkEncounter(): Promise<void> {
  const context: EncounterContext = {
    position: this.state.party.position,
    terrain: this.getCurrentTerrain(),
    timeSegment: this.state.time.daySegment,
    weather: this.state.weather,
    party: this.buildPartySnapshot(),
    factions: this.getFactionPresence(),
    eligibleCreatures: this.getEligibleCreatures(),
    trigger: 'travel'
  };

  const result = this.encounterService.generate(context);

  if (isOk(result)) {
    this.state.update(s => ({
      ...s,
      encounter: { status: 'preview', current: unwrap(result) }
    }));
  }
}
```

---

## Pipeline-Aufrufe zwischen Services

Services dürfen andere Services aufrufen, aber **nur als Teil einer festen Pipeline**:

```
EncounterService.generate()
        │
        ├── NPCService.generate()     ← Lead-NPC erstellen
        │
        └── LootService.generate()    ← Loot generieren
```

### Erlaubt: Feste Pipeline

```typescript
class EncounterService {
  constructor(
    private npcService: NPCService,
    private lootService: LootService
  ) {}

  generate(context: EncounterContext): Result<EncounterInstance, Error> {
    // 1. Gruppen erstellen
    const groups = this.createGroups(context);

    // 2. Lead-NPC generieren (Teil der Pipeline)
    if (needsLeadNPC(groups)) {
      const npc = this.npcService.generate({
        faction: context.factions[0],
        culture: context.factions[0].culture,
        role: 'leader',
        creatureBase: groups[0].leader
      });
      groups[0].leadNPC = npc;
    }

    // 3. Loot generieren (Teil der Pipeline)
    const loot = this.lootService.generate({
      creatures: groups.flatMap(g => g.creatures),
      partyLevel: context.party.level
    });

    return ok({ groups, loot, ... });
  }
}
```

### Verboten: Dynamische Queries

```typescript
// FALSCH - Service fragt anderen Service nach Informationen
class EncounterService {
  generate(context: EncounterContext) {
    // ❌ VERBOTEN: Query an anderen Service
    const weather = this.weatherService.getCurrentWeather();
    const time = this.timeService.getCurrentTime();

    // Das ist falsch! SessionControl muss alle Daten liefern.
  }
}
```

---

## Vault-Zugriff

Services dürfen den Vault lesen und schreiben:

### Lesen (Entities laden)

```typescript
class EncounterService {
  generate(context: EncounterContext) {
    // ✅ Creature-Definition aus Vault laden
    const creature = this.vault.getEntity('creature', creatureId);
  }
}
```

### Schreiben (Ergebnisse persistieren)

```typescript
class JournalService {
  createEntry(context: JournalContext): Result<JournalEntry, Error> {
    const entry = this.buildEntry(context);

    // ✅ Journal-Eintrag in Vault speichern
    this.vault.saveEntity('journal', entry);

    return ok(entry);
  }
}
```

---

## Verfügbare Services

| Service | Input | Output | Vault-Zugriff |
|---------|-------|--------|---------------|
| EncounterService | EncounterContext | EncounterInstance | Lesen (Creatures) |
| NPCService | NPCContext | NPCDefinition | Lesen/Schreiben |
| LootService | LootContext | GeneratedLoot | Lesen (Items) |
| WeatherService | WeatherInput | Weather | - |
| JournalService | JournalContext | JournalEntry | Schreiben |
| CombatService | CombatContext | CombatResult | - |

---

## Service-Dokumentation

Jeder Service hat eine eigene Dokumentation unter `docs/services/`:

- [Service-Pattern.md](../services/Service-Pattern.md) - Template für Service-Docs
- [encounter/](../services/encounter/) - Encounter-Pipeline
- [NPCs/](../services/NPCs/) - NPC-Generierung und Matching
- [Weather.md](../services/Weather.md) - Wetter-Generierung
- [Loot.md](../services/Loot.md) - Loot-Generierung

---

## Anti-Patterns

### 1. Service hält State

```typescript
// ❌ FALSCH
class WeatherService {
  private currentWeather: Weather;  // State im Service!

  getCurrentWeather() {
    return this.currentWeather;
  }
}

// ✅ RICHTIG
class WeatherService {
  generate(input: WeatherInput): Weather {
    // Pure function, kein interner State
  }
}
```

### 2. Service entscheidet über Workflow

```typescript
// ❌ FALSCH
class EncounterService {
  generate(context) {
    const encounter = this.build(context);

    if (encounter.isDeadly) {
      this.combatService.startCombat(encounter);  // Service startet Workflow!
    }
  }
}

// ✅ RICHTIG
class EncounterService {
  generate(context): Result<EncounterInstance, Error> {
    return ok(this.build(context));
    // SessionControl entscheidet, was mit dem Ergebnis passiert
  }
}
```

### 3. Service kommuniziert via Events

```typescript
// ❌ FALSCH
class EncounterService {
  generate(context) {
    const encounter = this.build(context);
    this.eventBus.publish('encounter:generated', encounter);  // Events!
  }
}

// ✅ RICHTIG
class EncounterService {
  generate(context): Result<EncounterInstance, Error> {
    return ok(this.build(context));
    // Kein EventBus, nur Return-Value
  }
}
```
