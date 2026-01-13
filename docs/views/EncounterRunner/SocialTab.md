# Social Tab

> **Parent:** [EncounterRunner](../EncounterRunner.md)
> **Verantwortlichkeit:** Social-Encounters mit Disposition-Tracking, NPC-Reaktionen und Skill-Challenges.

**Pfad:** `src/views/EncounterRunner/tabs/SocialTab.svelte`

---

## Uebersicht

Der Social-Tab behandelt nicht-kaempferische Begegnungen:

| Funktion | Beschreibung |
|----------|--------------|
| **Disposition-Tracking** | Einstellung des NPCs zur Party (-100 bis +100) |
| **NPC-Persoenlichkeit** | Traits, Goals, Quirks fuer Roleplay |
| **Skill-Challenges** | Strukturierte Erfolg/Misserfolg-Zaehlung |
| **Dialog-Log** | Gesprochene Saetze und Reaktionen |

---

## Layout (innerhalb EncounterRunner)

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│                     │                     │                     │
│   NPC-Portrait      │   Combat  Chase     │   NPC-Details       │
│                     │   [Social]          │                     │
│   ┌───────────┐     │                     │   Griknak           │
│   │           │     │   Disposition:      │   Goblin-Anführer   │
│   │   [NPC]   │     │   [█████░░░░░] 20   │                     │
│   │           │     │   Neutral           │   Traits:           │
│   └───────────┘     │                     │   - misstrauisch    │
│                     │   Skill Challenge:  │   - gierig          │
│   Reaktion:         │   ●●○ 2/3 Erfolge   │                     │
│   "Skeptisch"       │   ●○○ 1/3 Fehler    │   Goal:             │
│                     │                     │   Boss beeindrucken │
│                     │   [Persuasion]      │                     │
│                     │   [Deception]       │   Quirk:            │
│                     │   [Intimidation]    │   Hinkt links       │
│                     │                     │                     │
│                     │   Dialog Log:       │                     │
│                     │   > "Was wollt ihr?"│                     │
│                     │   > Persuasion DC14 │                     │
│                     │                     │                     │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

---

## Kernmechaniken

### Disposition-System

NPCs haben eine Disposition zur Party:

| Bereich | Bedeutung | Verhalten |
|---------|-----------|-----------|
| -100 bis -50 | Feindlich | Angriff wahrscheinlich |
| -49 bis -20 | Ablehnend | Keine Kooperation |
| -19 bis +19 | Neutral | Abwartend |
| +20 bis +49 | Freundlich | Kooperativ |
| +50 bis +100 | Loyal | Hilfsbereit |

### Disposition-Aenderung

```typescript
interface DispositionChange {
  skill: 'Persuasion' | 'Deception' | 'Intimidation' | 'Insight';
  dc: number;
  successDelta: number;   // z.B. +15
  failureDelta: number;   // z.B. -10
  criticalSuccess: number; // z.B. +25 bei nat 20
  criticalFail: number;    // z.B. -20 bei nat 1
}
```

### Skill-Challenges

Strukturierte Begegnungen mit Erfolgs-Schwelle:

```typescript
interface SkillChallenge {
  successThreshold: number;  // z.B. 3
  failureThreshold: number;  // z.B. 3
  currentSuccesses: number;
  currentFailures: number;
  usedSkills: string[];  // Verhindert Wiederholung
}
```

**Beispiel:** Ueberzeugen eines Lords
- 3 Erfolge noetig vor 3 Misserfolgen
- Jeder Skill nur 1x verwendbar
- Verschiedene Ansaetze: Persuasion, History, Insight

---

## Komponenten

### SocialTab.svelte

**Pfad:** `src/views/EncounterRunner/tabs/SocialTab.svelte`

```typescript
interface SocialTabProps {
  social: SocialState;
  onSkillCheck: (skill: string, dc: number) => void;
  onDispositionChange: (delta: number) => void;
  onEndEncounter: () => void;
}
```

### DispositionMeter

**Pfad:** `src/views/EncounterRunner/components/DispositionMeter.svelte`

```typescript
interface DispositionMeterProps {
  value: number;  // -100 bis +100
  onChange?: (newValue: number) => void;  // Fuer manuelle Anpassung
}
```

**Darstellung:**

```
Feindlich    Neutral    Freundlich
[░░░░░░░░░░|█████░░░░░|░░░░░░░░░░]
           ^
           20 (Neutral)
```

### SkillChallengeTracker

**Pfad:** `src/views/EncounterRunner/components/SkillChallengeTracker.svelte`

```typescript
interface SkillChallengeTrackerProps {
  challenge: SkillChallenge | null;
  onSuccess: () => void;
  onFailure: () => void;
}
```

**Darstellung:**

```
Erfolge:  ●●○  (2/3)
Fehler:   ●○○  (1/3)
```

### NPCPanel

**Pfad:** `src/views/EncounterRunner/components/NPCPanel.svelte`

```typescript
interface NPCPanelProps {
  npc: SocialNPC;
}

interface SocialNPC {
  id: string;
  name: string;
  title?: string;
  portrait?: string;
  personality: {
    primary: string;
    secondary?: string;
  };
  goal: string;
  quirk: string;
  currentReaction: string;  // z.B. "Skeptisch", "Interessiert"
}
```

### DialogLog

**Pfad:** `src/views/EncounterRunner/components/DialogLog.svelte`

```typescript
interface DialogLogProps {
  entries: DialogEntry[];
}

interface DialogEntry {
  speaker: 'npc' | 'party';
  text: string;
  skill?: string;
  dc?: number;
  result?: 'success' | 'failure' | 'critical';
}
```

---

## Controls

### Skill-Buttons

```
[Persuasion] [Deception] [Intimidation]
[Insight] [Performance] [Custom...]
```

| Button | Beschreibung |
|--------|--------------|
| **Persuasion** | Ueberzeugung durch Argumente |
| **Deception** | Luege oder Halbwahrheit |
| **Intimidation** | Einschuechterung |
| **Insight** | NPC-Absichten erkennen |
| **Custom** | Anderer Skill-Check |

### Skill-Check Dialog

```
┌────────────────────────────────────┐
│  Persuasion Check                  │
│                                    │
│  DC: [14] (anpassbar)              │
│                                    │
│  Bei Erfolg: +15 Disposition       │
│  Bei Fehler: -10 Disposition       │
│                                    │
│  [Wuerfeln] [Abbrechen]            │
└────────────────────────────────────┘
```

### Weitere Controls

```
[Disposition +5] [Disposition -5]   <- Manuelle Anpassung
[End Encounter]                      <- Beendet Social
```

---

## State

```typescript
interface SocialTabState {
  // NPC-Daten
  npcs: SocialNPC[];
  leadNPC: SocialNPC | null;

  // Disposition
  disposition: number;

  // Skill Challenge (optional)
  skillChallenge: SkillChallenge | null;

  // Dialog
  dialogLog: DialogEntry[];

  // Pending
  pendingSkillCheck: {
    skill: string;
    dc: number;
  } | null;
}
```

---

## Datenfluss

### Flow: Social starten

```
EncounterRunner empfaengt encounter:started (type: 'social')
    |
    v
encounterRunnerControl.startSocial(socialData)
    |
    v
SocialTab wird aktiv
    |
    v
NPC-Daten werden geladen
    |
    v
Initiale Disposition wird gesetzt
```

### Flow: Skill-Check

```
User klickt [Persuasion]
    |
    v
Skill-Check Dialog oeffnet
    |
    v
User setzt DC und klickt [Wuerfeln]
    |
    v
encounterRunnerWorkflow.resolveSkillCheck('Persuasion', 14)
    |
    v
Ergebnis wird berechnet
    |
    v
Disposition wird angepasst
    |
    v
Dialog-Eintrag wird hinzugefuegt
    |
    v
NPC-Reaktion wird aktualisiert
```

### Flow: Skill-Challenge Ende

```
skillChallenge.currentSuccesses >= threshold
    |
    v
encounter:resolved mit outcome: 'success'
    |
    v
Oder: currentFailures >= failureThreshold
    |
    v
encounter:resolved mit outcome: 'failure'
```

---

## Keyboard-Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `P` | Persuasion-Check |
| `D` | Deception-Check |
| `I` | Intimidation-Check |
| `+` | Disposition +5 |
| `-` | Disposition -5 |

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/views/EncounterRunner/tabs/SocialTab.svelte` | Tab-Container |
| `src/views/EncounterRunner/components/DispositionMeter.svelte` | Disposition-Anzeige |
| `src/views/EncounterRunner/components/SkillChallengeTracker.svelte` | Erfolg/Fehler-Zaehler |
| `src/views/EncounterRunner/components/NPCPanel.svelte` | NPC-Details |
| `src/views/EncounterRunner/components/DialogLog.svelte` | Gespraechsprotokoll |

---

*Siehe auch: [EncounterRunner](../EncounterRunner.md) | [CombatTab](CombatTab.md) | [ChaseTab](ChaseTab.md)*
