> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# CombatWorkflow

> **Verantwortlichkeit:** Orchestration des Combat-Trackers + State-Mutation
> **State-Owner:** sessionState
>
> **Verwandte Dokumente:**
> - [sessionState.md](sessionState.md) - State-Owner
> - [Combat.md](../features/Combat.md) - Feature-Spezifikation
> - [EncounterWorkflow.md](EncounterWorkflow.md) - Combat aus Encounter
> - [combatTracking](../services/combatTracking/combatTracking.md) - Resolution Service (READ-ONLY)
> - [CombatEvent](../types/combatEvent.md#conditions-als-combatevents) - Condition-Lifecycle als CombatEvents
> - [CombatEvent](../types/combatEvent.md) - Schema fuer Actions

Dieser Workflow orchestriert den Combat-Tracker. Er verwaltet Initiative, Zuege, die Post-Combat-Resolution und ist der **State-Owner** fuer Combat-State-Mutationen.

**Architektur:** Der `combatTracking` Service berechnet was passieren wuerde (READ-ONLY). Der `combatWorkflow` wendet das Ergebnis auf den State an (WRITE).

---

## State

```typescript
interface CombatWorkflowState {
  status: 'idle' | 'active';
  encounterId?: EntityId<'encounter'>;

  // Teilnehmer
  participants: CombatParticipant[];
  initiativeOrder: string[];      // Sortierte participant IDs

  // Aktueller Stand
  currentTurnIndex: number;
  roundNumber: number;
}

interface CombatParticipant {
  id: string;
  type: 'character' | 'creature';
  entityId: EntityId<'character' | 'creature'>;

  name: string;
  initiative: number;

  // HP-Tracking
  maxHp: number;
  currentHp: number;

  // Status
  conditions: Condition[];
  effects: CombatEffect[];

  // Konzentration
  concentratingOn?: string;
}
```

---

## State-Machine

```
idle → active → idle
```

| Transition | Trigger | Aktion |
|------------|---------|--------|
| idle → active | `startCombat()` | Participants bauen, Initiative |
| active → idle | `endCombat()` | Resolution starten |

---

## API

### startCombat

Startet Combat aus einem Encounter:

```typescript
startCombat(): void {
  const encounter = this.getState().encounter.current;
  if (!encounter) return;

  const participants = this.buildParticipants(encounter);

  this.updateState(s => ({
    ...s,
    encounter: { ...s.encounter, status: 'active' },
    combat: {
      status: 'active',
      encounterId: encounter.id,
      participants,
      initiativeOrder: [],  // Wird vom GM befuellt
      currentTurnIndex: 0,
      roundNumber: 1
    }
  }));
}
```

### setInitiative

GM traegt Initiative-Werte ein (gewuerfelt am Tisch):

```typescript
setInitiative(participantId: string, value: number): void {
  this.updateState(s => ({
    ...s,
    combat: {
      ...s.combat,
      participants: s.combat.participants.map(p =>
        p.id === participantId ? { ...p, initiative: value } : p
      )
    }
  }));
}

sortByInitiative(): void {
  const sorted = [...this.getState().combat.participants]
    .sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      // Bei Gleichstand: Characters vor Creatures
      if (a.type !== b.type) {
        return a.type === 'character' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .map(p => p.id);

  this.updateState(s => ({
    ...s,
    combat: { ...s.combat, initiativeOrder: sorted }
  }));
}
```

### nextTurn

Wechselt zum naechsten Teilnehmer:

```typescript
nextTurn(): void {
  const state = this.getState();
  const { initiativeOrder, currentTurnIndex, roundNumber } = state.combat;

  let newIndex = currentTurnIndex + 1;
  let newRound = roundNumber;

  if (newIndex >= initiativeOrder.length) {
    newIndex = 0;
    newRound++;
  }

  this.updateState(s => ({
    ...s,
    combat: {
      ...s.combat,
      currentTurnIndex: newIndex,
      roundNumber: newRound
    }
  }));

  // Duration-based Effects reduzieren
  this.processTurnEnd(initiativeOrder[currentTurnIndex]);
}
```

### endCombat

Beendet den Combat und startet Resolution:

```typescript
endCombat(): void {
  const state = this.getState();
  const { roundNumber } = state.combat;

  // Zeit voranschreiten (6 Sekunden pro Runde)
  const combatDuration = { seconds: roundNumber * 6 };
  this.advanceTime(combatDuration);

  // Encounter in Resolution-Status
  this.updateState(s => ({
    ...s,
    combat: {
      status: 'idle',
      participants: [],
      initiativeOrder: [],
      currentTurnIndex: 0,
      roundNumber: 0
    },
    encounter: { ...s.encounter, status: 'resolving' }
  }));
}
```

---

## HP-Tracking

### applyDamage / applyHealing

```typescript
applyDamage(participantId: string, amount: number): void {
  this.updateState(s => ({
    ...s,
    combat: {
      ...s.combat,
      participants: s.combat.participants.map(p => {
        if (p.id !== participantId) return p;

        const newHp = Math.max(0, p.currentHp - amount);

        // Konzentrations-Check bei Damage
        if (p.concentratingOn && amount > 0) {
          // UI zeigt Reminder fuer DC = max(10, damage/2)
        }

        return { ...p, currentHp: newHp };
      })
    }
  }));
}

applyHealing(participantId: string, amount: number): void {
  this.updateState(s => ({
    ...s,
    combat: {
      ...s.combat,
      participants: s.combat.participants.map(p => {
        if (p.id !== participantId) return p;
        const newHp = Math.min(p.maxHp, p.currentHp + amount);
        return { ...p, currentHp: newHp };
      })
    }
  }));
}
```

---

## Action Resolution (AI/Simulation)

Fuer AI-gesteuerte Combat-Simulation ruft der Workflow den combatTracking Service auf und wendet das Ergebnis an.

**Architektur-Trennung:**
- `combatTracking` (Service) = **READ-ONLY** - berechnet was passieren wuerde
- `combatWorkflow` = **WRITE** - wendet das Ergebnis auf den State an

```
combatWorkflow.runAction() [Orchestration]
        │
        └─► resolveAction(context)                 [READ-ONLY]
                │
                ├─► findTargets()
                ├─► getModifiers()
                ├─► determineSuccess()
                └─► resolveEffects()
                        │
                        ▼
                ResolutionResult
                        │
                        ▼
            applyResult(result, state)             [WRITE]
```

### runAction

Orchestriert die Resolution-Pipeline und wendet das Ergebnis an:

```typescript
import { resolveAction } from '@/services/combatTracking/resolution';

function runAction(
  input: { actorId: string; turnAction: TurnAction },
  state: CombatState
): ResolutionResult | null {
  const actor = state.combatants.find(c => c.id === input.actorId);
  if (!actor) return null;

  // 1. ResolutionContext bauen
  const context: ResolutionContext = {
    actor,
    action: input.turnAction.action,
    state,
    trigger: 'active',
    explicitTarget: input.turnAction.target,
    position: input.turnAction.position,
  };

  // 2. Resolution-Pipeline aufrufen (READ-ONLY)
  const result = resolveAction(context);

  // 3. Ergebnis anwenden (WRITE)
  applyResult(result, state, actor, input.turnAction);

  return result;
}
```

### applyResult

Wendet ein `ResolutionResult` auf den State an:

```typescript
function applyResult(result: ResolutionResult, state: CombatState): void {
  // 1. HP-Aenderungen
  for (const hpChange of result.hpChanges) {
    const combatant = findCombatant(state, hpChange.combatantId);
    setHP(combatant, createPMF(hpChange.newHP));
  }

  // 2. Conditions hinzufuegen
  for (const condApp of result.conditionsToAdd) {
    addCondition(condApp.target, {
      ...condApp.condition,
      probability: condApp.probability
    });
  }

  // 3. Conditions entfernen
  for (const condRem of result.conditionsToRemove) {
    const combatant = findCombatant(state, condRem.targetId);
    removeCondition(combatant, condRem.conditionName);
  }

  // 4. Forced Movement
  for (const movement of result.forcedMovement) {
    applyForcedMovement(state, movement);
  }

  // 5. Zone aktivieren
  if (result.zoneActivation) {
    state.activeZones.push(createActiveZone(result.zoneActivation));
  }

  // 6. Concentration brechen
  if (result.concentrationBreak) {
    breakConcentration(findCombatant(state, result.concentrationBreak), state);
  }

  // 7. Dead markieren
  markDeadCombatants(state);

  // 8. Protocol schreiben
  writeProtocolEntry(state, result.protocolData);
}
```

### ResolutionResult Interface

```typescript
interface ResolutionResult {
  hpChanges: HPChange[];
  conditionsToAdd: ConditionApplication[];
  conditionsToRemove: ConditionRemoval[];
  forcedMovement: ForcedMovementEntry[];
  zoneActivation?: ZoneActivation;
  concentrationBreak?: string;        // Combatant ID
  protocolData: ProtocolData;
}
```

### Anwendungs-Reihenfolge

Die Reihenfolge der Mutations ist wichtig fuer korrektes Verhalten:

1. **HP-Aenderungen** - Damage/Healing anwenden
2. **Concentration-Check** - Bei Damage pruefen ob Konzentration bricht
3. **Conditions anwenden** - Neue Conditions hinzufuegen
4. **Forced Movement** - Position-Updates
5. **Zone aktivieren** - Bei Zone-Aktionen
6. **Dead markieren** - Tote Combatants markieren
7. **Protocol schreiben** - Alles dokumentieren

### Verwandte Dokumente

- [actionResolution.md](../services/combatTracking/actionResolution.md) - Pipeline-Uebersicht
- [resolveEffects.md](../services/combatTracking/resolveEffects.md) - ResolutionResult-Struktur
- [getModifiers.md](../services/combatTracking/getModifiers.md) - Modifier-Sammlung

---

## Condition-Management

### addCondition / removeCondition

```typescript
addCondition(participantId: string, condition: Condition): void {
  this.updateState(s => ({
    ...s,
    combat: {
      ...s.combat,
      participants: s.combat.participants.map(p => {
        if (p.id !== participantId) return p;
        return { ...p, conditions: [...p.conditions, condition] };
      })
    }
  }));
}

removeCondition(participantId: string, conditionType: ConditionType): void {
  this.updateState(s => ({
    ...s,
    combat: {
      ...s.combat,
      participants: s.combat.participants.map(p => {
        if (p.id !== participantId) return p;
        return {
          ...p,
          conditions: p.conditions.filter(c => c.type !== conditionType)
        };
      })
    }
  }));
}
```

---

## Condition Lifecycle Integration

Die Condition-Verwaltung nutzt den `conditionLifecycle` Service fuer komplexe Beziehungen:

### Linked Conditions

Wenn eine Condition mit `linkedToSource` definiert ist, wird automatisch die linked Condition auf den Source angewendet:

```typescript
addCondition(target, { name: 'grappled', sourceId: grappler.id });
// → handleLinkedConditionOnApply: Grappler bekommt 'grappling'
```

### Death Triggers

Wenn ein Combatant stirbt, werden alle von ihm verursachten Conditions behandelt:

```typescript
markDeadCombatants(state);
// → handleSourceDeath: Entfernt 'grappled' von allen Targets (wenn onSourceDeath: 'remove-from-targets')
```

### Position Sync

Wenn ein Combatant bewegt wird, werden linked Targets mitbewegt:

```typescript
setPosition(grappler, newPos);
// → handlePositionSync: Grappled Target wird zu newPos bewegt
```

Details: [CombatEvent](../types/combatEvent.md#conditions-als-combatevents)

---

## AI Integration

Fuer AI-gesteuerte Combatants stellt der Workflow eine Schnittstelle bereit:

### requestAISuggestion

Fragt den `combatantAI` Service nach der besten Aktion:

```typescript
import { selectNextAction } from '@/services/combatantAI';

function requestAISuggestion(combatantId: string): TurnAction | null {
  const combatant = findCombatant(state, combatantId);
  if (!combatant) return null;

  const suggestion = selectNextAction({
    combatant,
    state,
    selectorType: 'greedy'  // oder 'minimax', 'ucb', etc.
  });

  return suggestion;
}
```

### executeAISuggestion

Fuehrt die vorgeschlagene Aktion aus:

```typescript
function executeAISuggestion(combatantId: string, suggestion: TurnAction): void {
  // 1. Bewegung ausfuehren (wenn vorhanden)
  if (suggestion.movement) {
    moveCombatant(combatantId, suggestion.movement);
  }

  // 2. Aktion ausfuehren
  runAction({ actorId: combatantId, turnAction: suggestion }, state);

  // 3. Budget aktualisieren
  consumeActionBudget(suggestion.action, getCurrentTurnBudget(combatantId));
}
```

Details: [combatantAI.md](../services/combatantAI/combatantAI.md)

---

## Post-Combat Resolution

Nach `endCombat()` wechselt der Encounter in den `resolving` Status.

### Resolution-Flow

```
combat:completed
    │
    ├── Phase 1: XP-Summary
    │   ├── XP automatisch berechnet
    │   ├── GM kann anpassen (+/-%)
    │   └── [Weiter] oder [Ueberspringen]
    │
    ├── Phase 2: Quest-Zuweisung (optional)
    │   └── User waehlt Quest oder ueberspringt
    │
    └── Phase 3: Loot-Verteilung
        └── User verteilt Loot oder ueberspringt
    │
    ▼
encounter:resolved
```

### XP-Berechnung

```typescript
function calculateCombatXP(participants: CombatParticipant[]): number {
  const defeatedCreatures = participants.filter(p =>
    p.type === 'creature' && p.currentHp === 0
  );

  return defeatedCreatures.reduce((sum, c) => {
    const creature = this.vault.getEntity('creature', c.entityId);
    return sum + creature.xp;
  }, 0);
}

// 40/60 Split bei Quest-Encounter
const immediateXP = Math.floor(totalXP * 0.4);
const questPoolXP = Math.floor(totalXP * 0.6);
```

Details: [Combat.md#post-combat-resolution](../features/Combat.md#post-combat-resolution)

---

## Workflow-Interaktionen

### Encounter → Combat

Combat startet immer aus einem Encounter:
1. Encounter muss im `preview` oder `active` Status sein
2. `startCombat()` wechselt beide States

### Combat → Zeit

Bei Combat-Ende wird Zeit automatisch vorgerueckt:
- 6 Sekunden pro Runde
- Beispiel: 10 Runden = 1 Minute

```typescript
const SECONDS_PER_ROUND = 6;
const combatDuration = { seconds: roundNumber * SECONDS_PER_ROUND };
this.advanceTime(combatDuration);
```

### Combat → Encounter Resolution

Nach Combat-Ende:
1. Combat-Status wechselt zu `idle`
2. Encounter-Status wechselt zu `resolving`
3. Resolution-UI erscheint (XP, Loot)

---

## Persistenz

Combat-State ist **resumable** (Plugin-Data):

```typescript
interface PersistedCombatState {
  status: 'active';
  encounterId: EntityId<'encounter'>;
  initiativeOrder: string[];
  currentTurnIndex: number;
  roundNumber: number;
  participants: PersistedParticipant[];
}

interface PersistedParticipant {
  id: string;
  currentHp: number;
  conditions: Condition[];
  // effects werden NICHT persistiert (zu komplex)
}
```

Bei Plugin-Reload:
1. Participants werden aus Vault neu geladen
2. HP und Conditions werden wiederhergestellt
3. Effects gehen verloren (GM wird benachrichtigt)
