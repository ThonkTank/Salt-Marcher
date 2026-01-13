# Chase Tab

> **Parent:** [EncounterRunner](../EncounterRunner.md)
> **Verantwortlichkeit:** Chase-Mechanik mit Distanz-Tracking, Komplikationen und Aktionen.

**Pfad:** `src/views/EncounterRunner/tabs/ChaseTab.svelte`

---

## Uebersicht

Der Chase-Tab behandelt Verfolgungsjagden nach D&D 5e DMG-Regeln:

| Funktion | Beschreibung |
|----------|--------------|
| **Distanz-Tracking** | Abstand in Zonen zwischen Gruppen |
| **Komplikationen** | Hindernisse und Skill-Checks |
| **Dash-Management** | CON-Saves bei wiederholtem Dash |
| **Escape/Capture** | Automatische Erkennung von Enden |

---

## Layout (innerhalb EncounterRunner)

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│                     │                     │                     │
│   Zone-Ansicht      │   Combat [Chase]    │   Detail View       │
│                     │    Social           │                     │
│   [Z1][Z2][Z3][Z4]  │                     │   Teilnehmer:       │
│    P       Q        │   Distanz: 3 Zonen  │   Name, Speed       │
│                     │   [====|====]       │   Dash-Count        │
│   Komplikationen:   │                     │   Conditions        │
│   Z2: Marktplatz    │   Round 2           │                     │
│   Z3: Enge Gasse    │                     │                     │
│                     │   [Dash] [Action]   │                     │
│                     │   [Komplikation]    │                     │
│                     │   [End Chase]       │                     │
│                     │                     │                     │
│                     │   Chase Log:        │                     │
│                     │   > Player dashed   │                     │
│                     │   > DC 12 DEX pass  │                     │
│                     │                     │                     │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

---

## Kernmechaniken

### Distanz-System

Chases verwenden ein **Zonen-System** statt exakter Distanzen:

| Distanz | Bedeutung |
|---------|-----------|
| 0 Zonen | Nahkampf moeglich, Capture imminent |
| 1-2 Zonen | Fernkampf moeglich |
| 3-4 Zonen | Nur lange Reichweite |
| 5+ Zonen | Escape moeglich |

### Komplikationen

Jede Zone kann eine Komplikation haben:

```typescript
interface Complication {
  zone: number;
  name: string;
  description: string;
  skillCheck: {
    ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
    dc: number;
  };
  failureEffect: string;  // z.B. "Verliert 1 Zone Fortschritt"
}
```

**Beispiele:**
- Marktplatz (DC 12 DEX) - Menge ausweichen
- Enge Gasse (DC 14 STR) - Durchquetschen
- Glatter Boden (DC 10 DEX) - Sturz vermeiden

### Dash-Erschoepfung

Nach wiederholtem Dash:

| Dash-Count | Effekt |
|------------|--------|
| 1-3 | Kein Effekt |
| 4+ | DC 10 CON Save pro Dash |
| Fail | 1 Level Exhaustion |

---

## Komponenten

### ChaseTab.svelte

**Pfad:** `src/views/EncounterRunner/tabs/ChaseTab.svelte`

```typescript
interface ChaseTabProps {
  chase: ChaseState;
  onDash: (participantId: string) => void;
  onAction: (participantId: string, action: ChaseAction) => void;
  onResolveComplication: (result: 'pass' | 'fail') => void;
  onEndChase: () => void;
}
```

### ZoneView

**Pfad:** `src/views/EncounterRunner/components/ZoneView.svelte`

Visualisiert Zonen und Teilnehmer-Positionen.

```typescript
interface ZoneViewProps {
  zones: Zone[];
  pursuers: ChaseParticipant[];
  quarry: ChaseParticipant[];
  complications: Complication[];
}
```

### DistanceTracker

**Pfad:** `src/views/EncounterRunner/components/DistanceTracker.svelte`

```typescript
interface DistanceTrackerProps {
  distance: number;
  maxDistance: number;  // Fuer Escape-Threshold
}
```

### ChaseLog

**Pfad:** `src/views/EncounterRunner/components/ChaseLog.svelte`

```typescript
interface ChaseLogProps {
  protocol: ChaseProtocolEntry[];
}
```

---

## Controls

### Aktions-Buttons

```
[Dash] [Action] [Komplikation wuerfeln] [End Chase]
```

| Button | Beschreibung |
|--------|--------------|
| **Dash** | +1 Zone Bewegung, Exhaustion-Tracking |
| **Action** | Andere Aktion (Angriff, Zauber, etc.) |
| **Komplikation** | Wuerfelt Skill-Check fuer aktive Komplikation |
| **End Chase** | Beendet Chase manuell |

### Komplikations-Dialog

```
┌────────────────────────────────────┐
│  Komplikation: Marktplatz          │
│                                    │
│  Eine dichte Menge blockiert den   │
│  Weg. Ausweichen oder durchdraengen│
│                                    │
│  DC 12 DEX (Acrobatics)            │
│                                    │
│  [Pass] [Fail]                     │
└────────────────────────────────────┘
```

---

## State

```typescript
interface ChaseTabState {
  // Teilnehmer
  pursuers: ChaseParticipant[];
  quarry: ChaseParticipant[];

  // Distanz
  distance: number;  // In Zonen

  // Zonen
  zones: Zone[];
  complications: Complication[];

  // Tracking
  round: number;
  currentParticipantIndex: number;

  // Pending
  pendingComplication: Complication | null;
}

interface ChaseParticipant {
  id: string;
  name: string;
  speed: number;
  dashCount: number;
  exhaustionLevel: number;
  zone: number;
}
```

---

## Datenfluss

### Flow: Chase starten

```
EncounterRunner empfaengt encounter:started (type: 'chase')
    |
    v
encounterRunnerControl.startChase(chaseData)
    |
    v
ChaseTab wird aktiv
    |
    v
Initiale Distanz wird gesetzt (typisch: 2-4 Zonen)
    |
    v
Komplikationen werden generiert
```

### Flow: Dash ausfuehren

```
User klickt [Dash] fuer Teilnehmer
    |
    v
encounterRunnerWorkflow.executeDash(participantId)
    |
    v
dashCount++
    |
    v
Wenn dashCount >= 4: CON-Save erforderlich
    |
    v
Distanz wird angepasst
    |
    v
Pruefen: Komplikation in neuer Zone?
    |
    v
Wenn ja: pendingComplication setzen
```

### Flow: Escape/Capture

```
Distanz wird aktualisiert
    |
    v
Wenn distance >= escapeThreshold (5):
    - Quarry escaped
    - chase:resolved mit outcome: 'escape'
    |
    v
Wenn distance <= 0:
    - Capture moeglich
    - chase:resolved mit outcome: 'capture'
```

---

## Keyboard-Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `D` | Dash fuer aktuellen Teilnehmer |
| `N` | Naechster Teilnehmer |
| `P` | Pass (Komplikation bestanden) |
| `F` | Fail (Komplikation fehlgeschlagen) |

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/views/EncounterRunner/tabs/ChaseTab.svelte` | Tab-Container |
| `src/views/EncounterRunner/components/ZoneView.svelte` | Zonen-Visualisierung |
| `src/views/EncounterRunner/components/DistanceTracker.svelte` | Distanz-Anzeige |
| `src/views/EncounterRunner/components/ChaseLog.svelte` | Protocol |

---

*Siehe auch: [EncounterRunner](../EncounterRunner.md) | [CombatTab](CombatTab.md) | [SocialTab](SocialTab.md)*
