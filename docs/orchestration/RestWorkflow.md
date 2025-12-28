# RestWorkflow

> **Verantwortlichkeit:** Orchestration von Short/Long Rest
> **State-Owner:** sessionState
>
> **Verwandte Dokumente:**
> - [sessionState.md](sessionState.md) - State-Owner
> - [Time.md](../features/Time.md#resting) - Rest-Spezifikation
> - [EncounterWorkflow.md](EncounterWorkflow.md) - Encounter-Unterbrechung

Dieser Workflow orchestriert Short/Long Rest mit stundenbasiertem Loop und Encounter-Unterbrechung.

---

## State

```typescript
interface RestWorkflowState {
  status: 'idle' | 'resting' | 'paused';
  type: 'short' | 'long' | null;
  hoursCompleted: number;
  hoursRemaining: number;
  interruptionCount: number;
}
```

---

## State-Machine

```
idle ─────────────────────────────────────────────────────────────┐
  │                                                                │
  │ startShortRest() / startLongRest()                             │
  ▼                                                                │
resting ──────────────────────────────────────────────────────────┤
  │   │                                                            │
  │   │ Pro Stunde: Encounter-Check                                │
  │   │                                                            │
  │   ├── Kein Encounter → Zeit +1h → weiter                       │
  │   │                                                            │
  │   └── Encounter! → pauseRest()                                 │
  │       │                                                        │
  │       ▼                                                        │
  │     paused ────────────────────────────────────────────────────┤
  │       │                                                        │
  │       ├── resumeRest() → zurueck zu resting                    │
  │       └── restartRest() → hoursCompleted = 0, resting          │
  │                                                                │
  │ Alle Stunden abgeschlossen                                     │
  ▼                                                                │
completeRest() ────────────────────────────────────────────────────┘
```

---

## Rest-Typen

| Typ | Dauer (Normal) | Dauer (Gritty Realism) |
|-----|---------------|------------------------|
| Short Rest | 1 Stunde | 1 Tag (24h) |
| Long Rest | 8 Stunden | 1 Woche (7 Tage) |

---

## API

### startShortRest / startLongRest

```typescript
startShortRest(): void {
  const duration = this.getRestDuration('short');

  this.updateState(s => ({
    ...s,
    rest: {
      status: 'resting',
      type: 'short',
      hoursCompleted: 0,
      hoursRemaining: duration.hours ?? duration.days * 24,
      interruptionCount: 0
    }
  }));

  this.advanceRestHour();
}

startLongRest(): void {
  const duration = this.getRestDuration('long');

  this.updateState(s => ({
    ...s,
    rest: {
      status: 'resting',
      type: 'long',
      hoursCompleted: 0,
      hoursRemaining: duration.hours ?? duration.days * 24,
      interruptionCount: 0
    }
  }));

  this.advanceRestHour();
}
```

### getRestDuration

Beruecksichtigt Gritty Realism Option:

```typescript
private getRestDuration(type: 'short' | 'long'): Duration {
  const settings = this.getRestSettings();

  if (settings.grittyRealism) {
    return type === 'short'
      ? { days: 1 }    // 24 Stunden
      : { days: 7 };   // 1 Woche
  } else {
    return type === 'short'
      ? { hours: 1 }   // 1 Stunde
      : { hours: 8 };  // 8 Stunden
  }
}
```

### advanceRestHour

Pro Stunde: Zeit voranschreiten und Encounter-Check:

```typescript
private async advanceRestHour(): Promise<void> {
  const state = this.getState();
  if (state.rest.status !== 'resting') return;

  // Encounter-Check
  const encounterResult = await this.checkEncounter();

  if (encounterResult) {
    // Encounter generiert → Rest pausieren
    this.updateState(s => ({
      ...s,
      rest: { ...s.rest, status: 'paused' }
    }));
    return;
  }

  // Kein Encounter → Zeit voranschreiten
  this.advanceTime({ hours: 1 });

  this.updateState(s => ({
    ...s,
    rest: {
      ...s.rest,
      hoursCompleted: s.rest.hoursCompleted + 1,
      hoursRemaining: s.rest.hoursRemaining - 1
    }
  }));

  // Pruefe ob Rest abgeschlossen
  if (this.getState().rest.hoursRemaining <= 0) {
    this.completeRest();
  } else {
    // Naechste Stunde
    this.advanceRestHour();
  }
}
```

### pauseRest

Automatisch bei Encounter:

```typescript
pauseRest(): void {
  this.updateState(s => ({
    ...s,
    rest: {
      ...s.rest,
      status: 'paused',
      interruptionCount: s.rest.interruptionCount + 1
    }
  }));
}
```

### resumeRest / restartRest

Nach Encounter-Resolution:

```typescript
resumeRest(): void {
  if (this.getState().rest.status !== 'paused') return;

  this.updateState(s => ({
    ...s,
    rest: { ...s.rest, status: 'resting' }
  }));

  this.advanceRestHour();
}

restartRest(): void {
  if (this.getState().rest.status !== 'paused') return;

  this.updateState(s => ({
    ...s,
    rest: {
      ...s.rest,
      status: 'resting',
      hoursCompleted: 0,
      hoursRemaining: this.getRestDuration(s.rest.type!).hours!
    }
  }));

  this.advanceRestHour();
}
```

### completeRest

```typescript
private completeRest(): void {
  const state = this.getState();
  const restType = state.rest.type;

  this.updateState(s => ({
    ...s,
    rest: {
      status: 'idle',
      type: null,
      hoursCompleted: 0,
      hoursRemaining: 0,
      interruptionCount: 0
    }
  }));

  // Journal-Eintrag erstellen
  this.journalService.createEntry({
    type: 'rest',
    timestamp: state.time.currentDateTime,
    data: { restType, interruptionCount: state.rest.interruptionCount }
  });

  // Post-MVP: Character-Recovery (HP, Spell Slots, etc.)
}
```

---

## Workflow-Interaktionen

### Rest → Encounter

Bei positivem Encounter-Check:
1. Rest wird pausiert
2. Encounter-Workflow uebernimmt
3. Nach Resolution: GM waehlt Resume oder Restart

```
Rest (resting)
    │
    ├── Encounter-Check positiv
    │
    ▼
Rest (paused) + Encounter (preview)
    │
    ├── Combat → Resolution
    │
    ▼
GM-Modal: "Rast fortsetzen?" / "Rast neustarten?"
    │
    ├── Fortsetzen → resumeRest()
    │   └── Verbleibende Stunden weiterlaufen
    │
    └── Neustarten → restartRest()
        └── hoursCompleted = 0
```

### Rest → Zeit

Pro Stunde wird Zeit vorgerueckt:

```typescript
// Im advanceRestHour:
this.advanceTime({ hours: 1 });
```

### Rest → XP-Budget Reset

Bei Long Rest wird das taegliche Encounter-XP-Budget zurueckgesetzt:

```typescript
// Bei Long Rest completion:
if (restType === 'long') {
  this.resetDailyEncounterBudget();
}
```

---

## Encounter-Chance waehrend Rest

Die Encounter-Chance waehrend Rest folgt der Standard-Berechnung:
- ~12.5% pro Stunde (wie bei Travel)
- Modifiziert durch Tile-Population

Details: [Travel.md#encounter-checks](../features/Travel.md#encounter-checks-waehrend-reisen)

---

## Persistenz

Rest-State ist **resumable** (Plugin-Data):

```typescript
interface PersistedRestState {
  status: 'resting' | 'paused';
  type: 'short' | 'long';
  hoursCompleted: number;
  hoursRemaining: number;
  interruptionCount: number;
}
```

Bei Plugin-Reload:
1. Rest-Status wird wiederhergestellt
2. Status ist `paused` (automatisches Fortsetzen waere verwirrend)
3. GM kann manuell fortsetzen oder neustarten
