> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# Trigger-System

> **Verantwortlichkeit:** Bestimmt WANN die Resolution-Pipeline aufgerufen wird
> **Pfad:** `src/services/combatTracking/triggers/`
> **Schema:** [CombatEvent.trigger](../../types/combatEvent.md#trigger) - Schema-driven DSL fuer Trigger

## Konzept

Das Trigger-System ist die Orchestrations-Schicht ueber der Resolution-Pipeline. Es entscheidet, wann welche Aktion ausgeloest wird.

```
┌─────────────────────────────────────────────────────────────┐
│  TRIGGER LAYER                                               │
├─────────────────────────────────────────────────────────────┤
│  activeAction.ts      → Spieler/AI waehlt Aktion            │
│  zoneTriggers.ts      → Zone-Effekte (on-enter, on-leave)   │
│  reactionTriggers.ts  → Reactions (attacked, damaged, OA)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  RESOLUTION PIPELINE (fuer alle Trigger gleich, READ-ONLY)  │
│  findTargets → getModifiers → determineSuccess → resolveEffects│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ResolutionResult
                              │
                              ▼
            combatWorkflow.applyResult() [WRITE]
```

---

## Trigger-Typen

| Trigger | Ausloeser | Beispiele | Datei |
|---------|-----------|-----------|-------|
| `active` | Spieler/AI waehlt | Longsword, Fireball | activeAction.ts |
| `zone-enter` | Bewegung in Zone | Spirit Guardians | zoneTriggers.ts |
| `zone-leave` | Bewegung aus Zone | **Opportunity Attack**, Web | zoneTriggers.ts |
| `zone-start-turn` | Rundenstart in Zone | Sickening Radiance | zoneTriggers.ts |
| `zone-end-turn` | Rundenende in Zone | Cloudkill | zoneTriggers.ts |
| `reaction-attacked` | Wird angegriffen | Shield | reactionTriggers.ts |
| `reaction-damaged` | Nimmt Schaden | Hellish Rebuke | reactionTriggers.ts |
| `reaction-spell-cast` | Zauber gewirkt | Counterspell | reactionTriggers.ts |

---

## Active Action Trigger

### Wann

Spieler oder AI waehlt eine Aktion aus dem Turn-Budget.

### Flow

```typescript
// In combatWorkflow.ts (Orchestrator)
import { resolveAction } from '@/services/combatTracking/resolution';

function runAction(
  input: { actorId: string; turnAction: TurnAction },
  state: CombatState
): ResolutionResult | null {
  const actor = state.combatants.find(c => c.id === input.actorId);
  if (!actor) return null;

  // ResolutionContext bauen
  const context: ResolutionContext = {
    actor,
    action: input.turnAction.action,
    state,
    trigger: 'active',
    explicitTarget: input.turnAction.target,
    position: input.turnAction.position,
  };

  // Pipeline aufrufen (READ-ONLY)
  const result = resolveAction(context);

  // Ergebnis anwenden (WRITE)
  applyResult(result, state, actor, input.turnAction);

  return result;
}
```

### Budget-Verbrauch

```typescript
function consumeActionBudget(
  action: Action,
  budget: TurnBudget
): void {
  const costs = action.budgetCosts;

  if (costs.action) budget.hasAction = false;
  if (costs.bonusAction) budget.hasBonusAction = false;
  if (costs.reaction) budget.hasReaction = false;
  if (costs.movement) budget.movementCells -= costs.movement.cells;
}
```

---

## Zone Triggers

### Zone-Typen

Zones werden durch Actions mit `zone`-Effekt erstellt:

```typescript
effects: [{
  zone: {
    radius: 15,
    targetFilter: 'enemies',
    trigger: 'on-enter' | 'on-leave' | 'on-start-turn' | 'on-end-turn'
  },
  damage: { dice: '3d8', type: 'radiant' },
  save: { ability: 'wis', dc: 14, onSave: 'half' }
}]
```

### on-enter

Wird ausgeloest wenn ein Combatant in die Zone bewegt wird.

```typescript
function checkZoneEnter(
  combatant: Combatant,
  newPosition: GridPosition,
  state: CombatState
): void {
  for (const zone of state.activeZones) {
    if (zone.effect.zone.trigger !== 'on-enter') continue;
    if (!isInZoneRadius(zone, newPosition, state)) continue;
    if (zone.triggeredThisTurn.has(combatant.id)) continue;
    if (!isValidZoneTarget(zone, combatant, state)) continue;

    // Pipeline aufrufen
    triggerZoneEffect(zone, combatant, 'zone-enter', state);
    zone.triggeredThisTurn.add(combatant.id);
  }
}
```

### on-leave

Wird ausgeloest wenn ein Combatant die Zone verlaesst.

```typescript
function checkZoneLeave(
  combatant: Combatant,
  oldPosition: GridPosition,
  newPosition: GridPosition,
  state: CombatState
): void {
  for (const zone of state.activeZones) {
    if (zone.effect.zone.trigger !== 'on-leave') continue;

    const wasInZone = isInZoneRadius(zone, oldPosition, state);
    const stillInZone = isInZoneRadius(zone, newPosition, state);

    if (wasInZone && !stillInZone) {
      triggerZoneEffect(zone, combatant, 'zone-leave', state);
    }
  }
}
```

### on-start-turn

Wird am Anfang des Zuges eines Combatants geprueft.

```typescript
function processZonesOnTurnStart(
  combatant: Combatant,
  state: CombatState
): void {
  for (const zone of state.activeZones) {
    if (zone.effect.zone.trigger !== 'on-start-turn') continue;
    if (!isInZoneRadius(zone, getPosition(combatant), state)) continue;
    if (!isValidZoneTarget(zone, combatant, state)) continue;

    triggerZoneEffect(zone, combatant, 'zone-start-turn', state);
  }
}
```

### on-end-turn

Wird am Ende des Zuges eines Combatants geprueft.

```typescript
function processZonesOnTurnEnd(
  combatant: Combatant,
  state: CombatState
): void {
  for (const zone of state.activeZones) {
    if (zone.effect.zone.trigger !== 'on-end-turn') continue;
    if (!isInZoneRadius(zone, getPosition(combatant), state)) continue;
    if (!isValidZoneTarget(zone, combatant, state)) continue;

    triggerZoneEffect(zone, combatant, 'zone-end-turn', state);
  }
}
```

### Zone-Trigger Helper

```typescript
function triggerZoneEffect(
  zone: ActiveZone,
  target: Combatant,
  trigger: TriggerType,
  state: CombatState
): void {
  const owner = state.combatants.find(c => c.id === zone.ownerId);
  if (!owner) return;

  const context: ResolutionContext = {
    actor: owner,
    action: buildZoneAction(zone),
    target,
    state,
    trigger
  };

  // Normale Pipeline
  const targets = findTargets(context);
  const success = determineSuccess(context, targets);
  const effects = gatherEffects(context, success);
  applyResults(context, effects);
}
```

---

## Opportunity Attack als Zone-on-leave

**Kern-Insight:** OA ist konzeptionell ein Zone-Effekt:

| Aspekt | Opportunity Attack | Spirit Guardians |
|--------|-------------------|------------------|
| Zone | Reichweite der Kreatur (5ft) | Radius um Caster (15ft) |
| Trigger | on-leave | on-enter, on-start-turn |
| Effekt | Melee-Attack | Save-basierter Damage |
| 1x/Turn | Ja (Reaction-Budget) | Ja (triggeredThisTurn) |

### OA-Zone erstellen

Bei Combat-Start wird fuer jeden Combatant eine implizite OA-Zone erstellt:

```typescript
function createOAZone(combatant: Combatant): ImplicitZone {
  return {
    ownerId: combatant.id,
    radius: getReach(combatant),      // Meist 5ft
    trigger: 'on-leave',
    targetFilter: 'enemies',
    isOA: true                        // Marker fuer Reaction-Budget
  };
}
```

### OA-Trigger

```typescript
function checkOpportunityAttack(
  mover: Combatant,
  path: GridPosition[],
  state: CombatState
): void {
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    for (const reactor of getAliveCombatants(state)) {
      if (!isHostile(reactor, mover)) continue;
      if (!hasReaction(reactor, state)) continue;

      const wasInReach = isInReach(reactor, from);
      const stillInReach = isInReach(reactor, to);

      if (wasInReach && !stillInReach) {
        // OA triggern
        triggerOpportunityAttack(reactor, mover, state);
      }
    }
  }
}

function triggerOpportunityAttack(
  reactor: Combatant,
  target: Combatant,
  state: CombatState
): void {
  const oaAction = findBestMeleeAttack(reactor);
  if (!oaAction) return;

  const context: ResolutionContext = {
    actor: reactor,
    action: oaAction,
    target,
    state,
    trigger: 'zone-leave'           // OA ist Zone-on-leave
  };

  // Pipeline + Reaction verbrauchen
  const targets = findTargets(context);
  const success = determineSuccess(context, targets);
  const effects = gatherEffects(context, success);
  applyResults(context, effects);

  consumeReaction(reactor, state);
}
```

---

## Reaction Triggers

### Reaction-Events

| Event | Wann | Beispiel-Reactions |
|-------|------|-------------------|
| `attacked` | Vor Attack-Resolution | Shield (+5 AC) |
| `damaged` | Nach Damage | Hellish Rebuke |
| `spell-cast` | Zauber wird gewirkt | Counterspell |

### attacked (Shield)

```typescript
function processAttackedReaction(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  state: CombatState
): { acBonus: number } {
  // Pruefe ob Target Shield-Reaction hat
  const shieldReaction = findReaction(target, 'attacked', state);
  if (!shieldReaction) return { acBonus: 0 };

  // Pruefe Reaction-Budget
  if (!hasReaction(target, state)) return { acBonus: 0 };

  // Evaluiere ob Reaction sinnvoll ist
  if (!shouldUseReaction(target, shieldReaction, { attacker, action })) {
    return { acBonus: 0 };
  }

  // Reaction ausfuehren
  consumeReaction(target, state);
  return { acBonus: shieldReaction.effects[0].statModifiers[0].value }; // +5
}
```

### damaged (Hellish Rebuke)

```typescript
function processDamagedReaction(
  attacker: Combatant,
  target: Combatant,
  damage: number,
  state: CombatState
): void {
  const rebukeReaction = findReaction(target, 'damaged', state);
  if (!rebukeReaction) return;
  if (!hasReaction(target, state)) return;

  // Reaction als eigene Aktion ausfuehren
  const context: ResolutionContext = {
    actor: target,
    action: rebukeReaction,
    target: attacker,
    state,
    trigger: 'reaction-damaged'
  };

  const targets = findTargets(context);
  const success = determineSuccess(context, targets);
  const effects = gatherEffects(context, success);
  applyResults(context, effects);

  consumeReaction(target, state);
}
```

### spell-cast (Counterspell)

```typescript
function processSpellCastReaction(
  caster: Combatant,
  spell: Action,
  state: CombatState
): { countered: boolean } {
  // Finde alle Combatants mit Counterspell in Reichweite
  for (const reactor of getAliveCombatants(state)) {
    if (!isHostile(reactor, caster)) continue;
    if (!hasReaction(reactor, state)) continue;
    if (!isInRange(reactor, caster, 60)) continue;

    const counterspell = findReaction(reactor, 'spell-cast', state);
    if (!counterspell) continue;

    // Evaluiere ob Counter sinnvoll ist
    if (!shouldCounterspell(reactor, caster, spell)) continue;

    // Counterspell ausfuehren
    consumeReaction(reactor, state);

    // Pruefe ob Counter erfolgreich (Spell-Level Check)
    const countered = resolveCounterspell(counterspell, spell);
    if (countered) {
      return { countered: true };
    }
  }

  return { countered: false };
}
```

---

## 1x/Turn Constraints

### Zone-Effekte

Jede Zone trackt welche Combatants diesen Turn schon getriggert wurden:

```typescript
interface ActiveZone {
  // ...
  triggeredThisTurn: Set<string>;   // Combatant IDs
}

// Reset am Rundenende
function resetZoneTriggersForCombatant(
  combatantId: string,
  state: CombatState
): void {
  for (const zone of state.activeZones) {
    zone.triggeredThisTurn.delete(combatantId);
  }
}
```

### Reactions

Reaction-Budget wird pro Runde getrackt:

```typescript
// In CombatState
reactionBudgets: Map<string, { hasReaction: boolean }>

// Reset am Turn-Start
function resetReactionBudget(
  combatant: Combatant,
  state: CombatState
): void {
  state.reactionBudgets.set(combatant.id, { hasReaction: true });
}

function consumeReaction(
  combatant: Combatant,
  state: CombatState
): void {
  const budget = state.reactionBudgets.get(combatant.id);
  if (budget) budget.hasReaction = false;
}

function hasReaction(
  combatant: Combatant,
  state: CombatState
): boolean {
  return state.reactionBudgets.get(combatant.id)?.hasReaction ?? false;
}
```

---

## Dateistruktur

```
src/services/combatTracking/triggers/
├── index.ts              # Re-exports
├── activeAction.ts       # Aktive Aktionen (Haupt-Entry)
├── zoneTriggers.ts       # Zone-Effekte (on-enter, on-leave, etc.)
│                         # Inkl. OA als Zone-on-leave
└── reactionTriggers.ts   # Reactions (attacked, damaged, spell-cast)
```

---

## Execution Order

### Active Action Flow

```
1. Spieler/AI waehlt Aktion
2. Budget-Check (hasAction, hasBonusAction, movement)
3. Optional: Reaction-Interception (siehe unten)
4. Resolution-Pipeline (READ-ONLY):
   findTargets → getModifiers → determineSuccess → resolveEffects
5. applyResult (WRITE)
6. Budget-Verbrauch
```

### Reaction Timing

Reactions koennen an verschiedenen Punkten feuern:

| Reaction-Typ | Wann | Modifiziert |
|--------------|------|-------------|
| `on-attacked` (Shield) | **VOR** determineSuccess | AC via Modifier |
| `on-damaged` (Hellish Rebuke) | **NACH** applyResult | Separate Resolution |
| `on-spell-cast` (Counterspell) | **VOR** Resolution | Bricht Aktion ab |
| `on-leaves-reach` (OA) | **WAEHREND** Bewegung | Separate Resolution |

**Wichtig:** Shield (+5 AC) wird als Modifier in der getModifiers-Phase hinzugefuegt,
NICHT als separate Resolution. Daher ist es ein "Input-Modifier".

### Movement + Zone Flow

```
1. Combatant bewegt sich (path: [start, ..., end])
2. Fuer jeden Schritt (from → to):
   a. on-leave Zones pruefen (inkl. OA)
   b. on-enter Zones pruefen
3. Am Ziel: Position-Sync pruefen (handlePositionSync)
```

### Turn Lifecycle

```
Turn-Start:
  1. Conditions mit 'end-of-turn' Save pruefen
  2. Reaction-Budget reset
  3. Zone 'on-start-turn' pruefen
  4. Concentration-Effekte aktualisieren

Turn-End:
  1. Zone 'on-end-turn' pruefen
  2. Conditions mit 'start-of-turn' Save pruefen
  3. Duration-Countdown fuer Runden-basierte Effekte
```

---

## Verwandte Dokumente

- [actionResolution.md](actionResolution.md) - Pipeline-Uebersicht
- [findTargets.md](findTargets.md) - Target-Auswahl
- [getModifiers.md](getModifiers.md) - Modifier-Sammlung
- [resolveEffects.md](resolveEffects.md) - Effekt-Resolution
- [CombatWorkflow.md](../../orchestration/CombatWorkflow.md) - State-Mutation
- [combatTracking.md](combatTracking.md) - Service-Uebersicht
- [CombatEvent.trigger](../../types/combatEvent.md#trigger) - Schema-Definition
- [Conditions als CombatEvents](../../types/combatEvent.md#conditions-als-combatevents) - Condition-Lifecycle
