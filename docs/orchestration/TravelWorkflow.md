# TravelWorkflow

> **Verantwortlichkeit:** Orchestration der Hex-Overland-Reise
> **State-Owner:** sessionState
>
> **Verwandte Dokumente:**
> - [sessionState.md](sessionState.md) - State-Owner
> - [Travel.md](../features/Travel.md) - Feature-Spezifikation (Speed, Encounter-Checks)
> - [EncounterWorkflow.md](EncounterWorkflow.md) - Encounter bei Reise

Dieser Workflow orchestriert die Hex-Overland-Reise. Er verwaltet die State-Machine und koordiniert die Interaktion mit Time, Weather und Encounter.

---

## State

```typescript
interface TravelWorkflowState {
  status: 'idle' | 'planning' | 'traveling' | 'paused';
  route: Route | null;
  progress: TravelProgress | null;
  animationState: AnimationState | null;
}

interface TravelProgress {
  current: number;      // Aktueller Segment-Index
  total: number;        // Gesamtzahl Segmente
  distanceCovered: number;  // Meilen
  timeElapsed: Duration;    // Verstrichene Zeit
}
```

---

## State-Machine

```
idle → planning → traveling ↔ paused → idle (on completion)
```

| Transition | Trigger | Aktion |
|------------|---------|--------|
| idle → planning | `planRoute(waypoints)` | Route berechnen |
| planning → traveling | `startTravel()` | Animation starten |
| traveling → paused | Encounter oder GM-Pause | Animation stoppen |
| paused → traveling | `resumeTravel()` | Animation fortsetzen |
| traveling → idle | Route abgeschlossen | State zuruecksetzen |
| * → idle | `cancelTravel()` | Abbruch |

---

## API

### startTravel

Startet die Reise entlang einer geplanten Route.

```typescript
startTravel(route: Route): Result<void, TravelError> {
  // Validierung
  if (this.getState().travel.status !== 'idle') {
    return err({ code: 'TRAVEL_ALREADY_ACTIVE' });
  }

  this.updateState(s => ({
    ...s,
    travel: {
      status: 'traveling',
      route,
      progress: { current: 0, total: route.segments.length },
      animationState: null
    }
  }));

  return ok(undefined);
}
```

### pauseTravel / resumeTravel

```typescript
pauseTravel(): void {
  this.updateState(s => ({
    ...s,
    travel: { ...s.travel, status: 'paused' }
  }));
}

resumeTravel(): void {
  if (this.getState().travel.status !== 'paused') return;

  this.updateState(s => ({
    ...s,
    travel: { ...s.travel, status: 'traveling' }
  }));
}
```

### cancelTravel

```typescript
cancelTravel(): void {
  this.updateState(s => ({
    ...s,
    travel: {
      status: 'idle',
      route: null,
      progress: null,
      animationState: null
    }
  }));
}
```

---

## Tick-Verarbeitung

Pro Animation-Tick wird folgendes ausgefuehrt:

```typescript
async advanceTravelTick(): Promise<void> {
  const state = this.getState();
  if (state.travel.status !== 'traveling') return;

  // 1. Position aktualisieren
  const newPosition = this.calculateNextPosition();

  // 2. Zeit voranschreiten
  const newTime = this.advanceTimeBy({ minutes: TICK_DURATION });

  // 3. Wetter neu berechnen
  const weather = this.weatherService.generate({
    terrain: this.getCurrentTerrain(),
    season: this.getCurrentSeason(),
    timeSegment: newTime.daySegment
  });

  this.updateState(s => ({
    ...s,
    party: { ...s.party, position: newPosition },
    time: newTime,
    weather
  }));

  // 4. Encounter-Check bei Stundenwechsel
  if (this.isHourBoundary()) {
    await this.checkEncounter();
  }
}
```

### Encounter-Check

Bei Stundenwechsel wird geprueft ob ein Encounter erscheint:

```typescript
private async checkEncounter(): Promise<void> {
  // Encounter-Check via EncounterWorkflow
  // Bei Encounter: Travel wird automatisch pausiert
  // Siehe EncounterWorkflow.md
}
```

Details zur Encounter-Chance: [Travel.md#encounter-checks](../features/Travel.md#encounter-checks-waehrend-reisen)

---

## Workflow-Interaktionen

### Travel → Encounter

Bei positivem Encounter-Check:
1. Travel-Status wechselt zu `paused`
2. Encounter-Workflow uebernimmt
3. Nach Encounter-Resolution: GM entscheidet ob `resumeTravel()` oder `cancelTravel()`

```typescript
// Bei Encounter-Trigger
this.updateState(s => ({
  ...s,
  travel: { ...s.travel, status: 'paused' },
  encounter: { status: 'preview', current: encounter }
}));
```

### Travel → Zeit

Jeder Tick rueckt die Zeit um `TICK_DURATION` Minuten vor:

```typescript
const TICK_DURATION = 10; // Minuten pro Animation-Tick

// Im advanceTravelTick:
this.updateState(s => ({
  ...s,
  time: addDuration(s.time.currentDateTime, { minutes: TICK_DURATION })
}));
```

### Travel → Wetter

Wetter wird bei jedem Tick neu berechnet basierend auf:
- Aktuelles Terrain
- Aktuelle Jahreszeit
- Aktuelles Zeit-Segment

---

## Validierung

### Transport-Validierung

Vor Reise-Start wird geprueft ob der Transport verfuegbar ist:

```typescript
// INVARIANT: activeTransport muss in Party.availableTransports enthalten sein
if (!state.party.availableTransports.includes(transport)) {
  return err({ code: 'TRANSPORT_NOT_AVAILABLE', transport });
}
```

### Terrain-Validierung

Bestimmte Terrains sind nur mit bestimmten Transport-Modi passierbar:

| Transport | Einschraenkungen |
|-----------|-----------------|
| `foot` | Keine |
| `mounted` | Kein dichter Wald, kein Sumpf |
| `carriage` | Nur Strassen |
| `boat` | Nur Wasser |

---

## Persistenz

Travel-State ist **resumable** (Plugin-Data):

```typescript
interface PersistedTravelState {
  status: 'traveling' | 'paused';
  routeId: string;
  progress: TravelProgress;
  // animationState wird NICHT persistiert
}
```

Bei Plugin-Reload:
1. Route wird aus Vault geladen
2. Progress wird wiederhergestellt
3. Status ist `paused` (Animation startet nicht automatisch)
