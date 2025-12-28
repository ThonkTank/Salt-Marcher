# CombatWorkflow

> **Verantwortlichkeit:** Orchestration des Combat-Trackers
> **State-Owner:** SessionControl
>
> **Verwandte Dokumente:**
> - [SessionControl.md](SessionControl.md) - State-Owner
> - [Combat.md](../features/Combat.md) - Feature-Spezifikation
> - [EncounterWorkflow.md](EncounterWorkflow.md) - Combat aus Encounter

Dieser Workflow orchestriert den Combat-Tracker. Er verwaltet Initiative, Zuege und die Post-Combat-Resolution.

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
