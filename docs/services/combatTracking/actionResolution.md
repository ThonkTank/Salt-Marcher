# Action Resolution Pipeline

> **Verantwortlichkeit:** Einheitliche Resolution aller Combat-Aktionen (aktiv, Zones, Reactions)
> **Pfad:** `src/services/combatTracking/resolution/`

## Architektur-Trennung

Der combatTracking Service ist **READ-ONLY**. Er berechnet was passieren wuerde und returned ein `ResolutionResult`. Der `combatWorkflow` ist der **State-Owner** und wendet das Ergebnis auf den State an.

```
┌─────────────────────────────────────────────────────────────┐
│  combatWorkflow (State-Owner)                               │
│  - Darf State lesen UND schreiben                           │
│  - Ruft combatTracking auf                                  │
│  - Wendet ResolutionResult auf State an                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  combatTracking (Resolution Service) - READ-ONLY            │
│  - Darf State nur LESEN                                     │
│  - Berechnet was passieren wuerde                           │
│  - Returned ResolutionResult                                │
└─────────────────────────────────────────────────────────────┘
```

**Warum?**
- Services sind testbar ohne State-Mocking
- Klare Trennung: "Was wuerde passieren?" vs "Mach es"
- Konsistent mit bestehender Architektur (encounterWorkflow, travelWorkflow)

---

## Konzept

Alle Combat-Aktionen durchlaufen dieselbe vierstufige Pipeline. Der Unterschied zwischen aktiven Aktionen, Zone-Effekten und Reactions liegt nur im **Trigger** - nicht in der Resolution-Logik.

```
┌─────────────────────────────────────────────────────────────┐
│  TRIGGER LAYER (wann wird Pipeline aufgerufen?)             │
├─────────────────────────────────────────────────────────────┤
│  • Aktive Aktion      → Spieler/AI waehlt                   │
│  • Zone on-enter      → Bewegung in Zone                    │
│  • Zone on-leave      → Bewegung aus Zone (inkl. OA!)       │
│  • Zone on-start-turn → Rundenstart in Zone                 │
│  • Zone on-end-turn   → Rundenende in Zone                  │
│  • Reaction-Event     → attacked, damaged, spell-cast       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  RESOLUTION PIPELINE (READ-ONLY)                            │
├─────────────────────────────────────────────────────────────┤
│  findTargets      → Wer wird getroffen?                     │
│  gatherModifiers  → Advantage, Bless, Pack Tactics, etc.    │
│  determineSuccess → Trifft es? (Attack/Save/Contested)      │
│  resolveEffects   → Was passiert? (Damage, Conditions)      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ResolutionResult
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  combatWorkflow.applyResult() - WRITE                       │
│  - HP-Aenderungen anwenden                                  │
│  - Conditions hinzufuegen/entfernen                         │
│  - Position-Updates                                         │
│  - Protocol-Entry schreiben                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Pipeline-Komponenten

| Komponente | Verantwortung | Dokument |
|------------|---------------|----------|
| `findTargets` | Ziel-Auswahl, Range, AoE | [findTargets.md](findTargets.md) |
| `gatherModifiers` | Modifier sammeln (Adv/Disadv, Boni, AC) | [gatherModifiers.md](gatherModifiers.md) |
| `determineSuccess` | Wuerfel-Resolution unter Beruecksichtigung der Modifiers | [determineSuccess.md](determineSuccess.md) |
| `resolveEffects` | Effekte berechnen, inkl. sekundaere Saves | [resolveEffects.md](resolveEffects.md) |

Trigger-System: [triggers.md](triggers.md)

State-Mutation: [CombatWorkflow.md](../../orchestration/CombatWorkflow.md)

---

## Datenfluss

```
ResolutionContext (READ-ONLY state!)
    │
    ├─► findTargets(context)
    │       Input:  Action, Actor-Position, State
    │       Output: TargetResult { targets[], isAoE }
    │
    ├─► gatherModifiers(context, targets)
    │       Input:  Actor, Targets, State (Conditions, Traits, Buffs)
    │       Output: ModifierSet[] (pro Target)
    │
    ├─► determineSuccess(context, targets, modifiers)
    │       Input:  Action, Targets, ModifierSet
    │       Output: SuccessResult[] (pro Target)
    │
    └─► resolveEffects(context, successResults)
            Input:  Action, Success/Fail pro Target
            Output: ResolutionResult (pure data, keine Mutation)

                              │
                              ▼
              combatWorkflow.applyResult(result, state)
                      State wird mutiert
                      Protocol-Entry geschrieben
```

---

## Interface-Definitionen

### Pipeline-Input

```typescript
// Kontext fuer die gesamte Pipeline
interface ResolutionContext {
  actor: Combatant;
  action: Action;
  state: Readonly<CombatState>;     // READ-ONLY!
  trigger: TriggerType;
  target?: Combatant;               // Bei Single-Target bereits bekannt
  position?: GridPosition;          // Ziel-Position bei AoE
}

type TriggerType =
  | 'active'                        // Spieler/AI waehlt Aktion
  | 'zone-enter'                    // Bewegung in Zone
  | 'zone-leave'                    // Bewegung aus Zone (inkl. OA)
  | 'zone-start-turn'               // Rundenstart in Zone
  | 'zone-end-turn'                 // Rundenende in Zone
  | 'reaction-attacked'             // Reaction: Shield
  | 'reaction-damaged'              // Reaction: Hellish Rebuke
  | 'reaction-spell-cast';          // Reaction: Counterspell
```

### Zwischen-Ergebnisse

```typescript
// Output von findTargets
interface TargetResult {
  targets: Combatant[];
  isAoE: boolean;
  friendlyFire: boolean;
}

// Output von gatherModifiers (pro Actor-Target Paar)
interface ModifierSet {
  attackAdvantage: AdvantageState;  // 'advantage' | 'disadvantage' | 'none'
  attackBonus: number;              // Flat bonus (Bless, etc.)
  targetACBonus: number;            // Shield, Cover, etc.
  saveAdvantage: AdvantageState;    // Magic Resistance, etc.
  saveBonus: number;                // Bless on save, etc.
  damageBonus: number;              // Extra damage modifiers
}

// Output von determineSuccess (pro Target)
interface SuccessResult {
  target: Combatant;
  hit: boolean;
  critical: boolean;
  hitProbability: number;           // Exakte Wahrscheinlichkeit
  saveSucceeded?: boolean;          // Bei Save-Aktionen
  contestWon?: boolean;             // Bei Contested Checks
  damageMultiplier: number;         // 1.0 normal, 0.5 bei save-half, 2.0 bei crit
}
```

### Pipeline-Output (Pure Data)

```typescript
// Finales Ergebnis - KEINE State-Mutation, nur Daten
interface ResolutionResult {
  hpChanges: HPChange[];
  conditionsToAdd: ConditionApplication[];
  conditionsToRemove: ConditionRemoval[];
  forcedMovement: ForcedMovementEntry[];
  zoneActivation?: ZoneActivation;
  concentrationBreak?: string;      // Combatant ID
  protocolData: ProtocolData;       // Fuer Protocol-Entry
}

interface HPChange {
  combatantId: string;
  previousHP: number;
  newHP: number;
  change: number;
  source: string;
  damageType?: DamageType;
}

interface ConditionApplication {
  target: Combatant;
  condition: ConditionState;
  probability: number;              // 0-1, nach Save-Chance
}

interface ConditionRemoval {
  targetId: string;
  conditionName: string;
}
```

---

## Unified Model: OA als Zone-Effekt

Opportunity Attacks sind konzeptionell Zone-Effekte:

| Aspekt | OA | Spirit Guardians |
|--------|----|--------------------|
| Zone | Reichweite der Kreatur (5ft) | Radius um Caster (15ft) |
| Trigger | on-leave | on-enter, on-start-turn |
| Effekt | Melee-Attack (Reaction) | Save-basierter Damage |
| 1x/Turn | Ja (Reaction-Budget) | Ja (triggeredThisTurn) |

Beide nutzen dieselbe Pipeline - nur der Trigger und die Action unterscheiden sich.

---

## Beispiel-Flow: Longsword Attack

```
1. Trigger: 'active' (Spieler waehlt Aktion)

2. findTargets:
   - Action.targeting.type = 'single'
   - Action.targeting.validTargets = 'enemies'
   - Action.range = { type: 'reach', normal: 5 }
   → TargetResult { targets: [Goblin], isAoE: false }

3. gatherModifiers:
   - Actor Conditions: keine
   - Target Conditions: prone → Advantage (Melee)
   - Traits: keine
   - Buffs: Bless auf Actor → +1d4 attack
   → ModifierSet { attackAdvantage: 'advantage', attackBonus: 2.5 }

4. determineSuccess:
   - Action.attack = { bonus: 5 }
   - Target AC = 13
   - Mit Advantage + Bless: Hit-Chance = 0.85
   → SuccessResult { hit: true, critical: false, damageMultiplier: 1.0 }

5. resolveEffects:
   - Action.damage = { dice: '1d8', modifier: 3, type: 'slashing' }
   - Expected: 7.5
   → ResolutionResult {
       hpChanges: [{ combatantId: 'goblin-1', change: -7.5, ... }],
       conditionsToAdd: [],
       ...
     }

6. combatWorkflow.applyResult():
   - setHP(Goblin, newHP)
   - writeProtocolEntry(...)
```

---

## Beispiel-Flow: Wolf Bite (mit sekundaerem Save)

```
1. Trigger: 'active'

2. findTargets:
   → TargetResult { targets: [Bandit], isAoE: false }

3. gatherModifiers:
   - Pack Tactics (Ally adjacent) → Advantage
   → ModifierSet { attackAdvantage: 'advantage' }

4. determineSuccess (Primary: Attack Roll):
   - Action.attack = { bonus: 4 }
   - Target AC = 12
   → SuccessResult { hit: true, damageMultiplier: 1.0 }

5. resolveEffects:
   - Primary: 2d4+2 piercing = 7
   - Effect: knockdown auf STR DC 11 (onSave: 'none')
   - Bandit STR save: +1, Fail-Chance = 0.55
   → ResolutionResult {
       hpChanges: [{ change: -7, ... }],
       conditionsToAdd: [{ condition: 'prone', probability: 0.55 }],
       ...
     }

6. combatWorkflow.applyResult():
   - setHP(Bandit, newHP)
   - addCondition(Bandit, 'prone', probability: 0.55)
```

---

## Dateien

```
src/services/combatTracking/           # READ-ONLY Service
├── index.ts                           # Public API
├── combatState.ts                     # State-Accessors (READ-ONLY)
├── initialiseCombat.ts                # Combat Init
│
├── resolution/                        # Pipeline-Komponenten (alle READ-ONLY)
│   ├── index.ts                       # Re-exports
│   ├── types.ts                       # Interface-Definitionen
│   ├── findTargets.ts                 # Target Selection
│   ├── gatherModifiers.ts             # Modifier Collection
│   ├── determineSuccess.ts            # Attack/Save/Contested
│   └── resolveEffects.ts              # Effect Resolution (returns data)
│
└── triggers/                          # Trigger-Erkennung (READ-ONLY)
    ├── index.ts
    ├── zoneTriggers.ts                # Zone-Effekte erkennen
    └── reactionTriggers.ts            # Reaction-Events erkennen

src/workflows/
└── combatWorkflow.ts                  # State-Owner (WRITE)
    ├── executeAction()                # Orchestriert Pipeline + Apply
    ├── applyResult()                  # State-Mutation
    └── writeProtocol()                # Protocol-Entry
```

---

## Verwandte Dokumente

- [combatTracking.md](combatTracking.md) - Service-Uebersicht
- [triggers.md](triggers.md) - Trigger-System Details
- [gatherModifiers.md](gatherModifiers.md) - Modifier-Sammlung
- [resolveEffects.md](resolveEffects.md) - Effekt-Resolution
- [CombatWorkflow.md](../../orchestration/CombatWorkflow.md) - State-Mutation
- [../combatantAI/combatantAI.md](../combatantAI/combatantAI.md) - AI-Entscheidungslogik
