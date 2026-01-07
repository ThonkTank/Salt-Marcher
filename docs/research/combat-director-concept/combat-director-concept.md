# Handoff: Combat Director - Intelligente Combat AI

> **Status:** Konzept-Phase, abhängig von Performance-Fixes
> **Priorität:** Feature-Erweiterung nach Stabilisierung
> **Abhängigkeit:** [combat-simulator-performance.md](combat-simulator-performance.md) muss zuerst abgeschlossen sein

---

## Vision

Combat AI die nicht nur "optimal spielt", sondern **verschiedene Ziele verfolgen kann**:

---

## Rahmenbedingungen

### GM-in-the-Loop Workflow

Das Plugin ist **Decision Support**, nicht autonome AI:

```
┌─────────────────────────────────────────────────────────────┐
│ Combat Director                                              │
│   → Analysiert Situation                                    │
│   → Generiert Vorschlag (Action + Target + Begründung)      │
│   → Zeigt Vorschlag in UI                                   │
└─────────────────────────────────────────────────────────────┘
         │ Vorschlag
         ▼
┌─────────────────────────────────────────────────────────────┐
│ GM am Tisch                                                  │
│   → Entscheidet ob Vorschlag passt                          │
│   → Führt Aktion am Tisch aus (Würfeln, Ansagen)           │
│   → Gibt Ergebnis ins Plugin ein (Hit/Miss, Damage)        │
│   → Beendet Turn / Runde manuell                           │
└─────────────────────────────────────────────────────────────┘
         │ Ergebnis
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Combat State Update                                          │
│   → HP anpassen                                             │
│   → Conditions tracken                                      │
│   → Nächster Turn → neuer Vorschlag                        │
└─────────────────────────────────────────────────────────────┘
```

**Konsequenzen:**
- Keine autonome Execution von Aktionen
- Vorschläge müssen schnell generiert werden (GM wartet)
- Vorschläge müssen **erklärbar** sein (GM will verstehen warum)
- GM kann jederzeit anders entscheiden (kein Lock-in)

### Hardware-Constraints

**Ziel-Hardware:** Standard-Laptop ohne dedizierte GPU

| Komponente | Spezifikation | Implikation |
|------------|---------------|-------------|
| **CPU** | Intel i5-8365U @ 1.60GHz (4 Kerne) | Single-Thread Performance begrenzt |
| **RAM** | ~40 GB | Kein Memory-Problem |
| **GPU** | Intel UHD 620 (integriert) | Keine GPU-Berechnungen möglich |

**Performance-Budget:**
- **Ideal:** < 100ms pro Turn (instant feeling)
- **Akzeptabel:** < 1s pro Turn (natürlicher Denkmoment)
- **Maximum:** < 5s pro Runde (bei vielen Kreaturen)
- **Unakzeptabel:** > 5s pro Runde (unterbricht Spielfluss)

**Konsequenz für AI-Auswahl:**
- Bei 6 Kreaturen pro Runde: ~800ms Budget pro Kreatur
- MCTS mit 500-1000 Iterationen wird dadurch möglich
- Tiefere Lookahead-Suche (2-3 Runden) machbar
- Qualität vor Geschwindigkeit, solange Budget eingehalten

**Ausgeschlossene Ansätze:**
- Deep Reinforcement Learning (GPU-Training erforderlich, Black-Box)
- MCTS mit >5000 Iterationen pro Turn

### Schema-basierte Erweiterbarkeit

**Prinzip:** Neue Kreaturen erfordern **keinen neuen Code**.

```typescript
// RICHTIG: Generisches Scoring über Schema-Attribute
function scoreAction(action: Action, target: CombatProfile): number {
  const baseDamage = evaluateDamageExpression(action.damage); // "2d6+3"
  const range = action.range;                                  // 30
  const aoe = action.areaOfEffect;                            // { shape: 'cone', size: 15 }
  const saveDC = action.saveDC;                               // { ability: 'dex', dc: 15 }

  // Scoring basiert auf Schema-Feldern, nicht auf Creature-Typ
  return calculateUtility(baseDamage, range, aoe, saveDC, target);
}

// FALSCH: Hardcodierte Creature-Logik
function scoreAction(action: Action, creature: Creature): number {
  if (creature.id === 'dragon') {
    return scoreBreathWeapon(action);  // ❌ Creature-spezifisch
  }
  if (creature.id === 'goblin') {
    return scoreHitAndRun(action);     // ❌ Creature-spezifisch
  }
  return defaultScore(action);
}
```

**Schema-Attribute für Scoring:**

| Attribut | Typ | Scoring-Relevanz |
|----------|-----|------------------|
| `damage` | Dice Expression | Expected Damage berechnen |
| `range` | number | Erreichbarkeit, Positioning |
| `areaOfEffect` | AOE Schema | Multi-Target Potential |
| `saveDC` | Save Schema | Erfolgswahrscheinlichkeit |
| `conditions` | Condition[] | CC-Wert, Debuff-Stärke |
| `uses` | number/recharge | Resource-Management |
| `actionType` | action/bonus/reaction | Action Economy |

**Personality über Schema, nicht Code:**

```typescript
// CombatPersonality ist Schema-definiert, nicht Code
const dragonPersonality: CombatPersonality = {
  aggression: 0.7,
  targetPriority: 'highest-threat',
  tactics: 'flanking',
  morale: { fleeAtHPPercent: 10, neverFlee: false },
  tacticalIntelligence: 18,
};

// Scoring-Funktion ist generisch, Personality kommt aus Schema
function scoreWithPersonality(action, target, personality): number {
  // Generischer Code, keine Dragon-spezifische Logik
}
```

---

## Analyse der existierenden Grundlagen

> **Scope:** ~3800 LOC in drei Kerndateien
> **Wiederverwendbar:** ~2150 LOC (57%)

### Übersicht der Implementation

| Datei | LOC | Funktion | Bewertung |
|-------|-----|----------|-----------|
| [turnExecution.ts](../../src/services/combatantAI/turnExecution.ts) | ~1300 | Beam Search Turn-Planning | ✅ Solide Basis |
| [actionScoring.ts](../../src/services/combatantAI/actionScoring.ts) | ~1580 | DPR-basierte Bewertung | ✅ Kern-Baustein |
| [influenceMaps.ts](../../src/services/combatantAI/influenceMaps.ts) | ~400 | Layer-basiertes Positioning | ✅ Implementiert |

### turnExecution.ts - Beam Search

**Algorithmus:** Iteratives Pruning mit 50%-Threshold
```
Root → Expand (Move, Action, Bonus, Pass) → Prune (50% threshold) → Wiederhole → Bester Terminal-Kandidat
```

**Konstanten:**
- `PRUNING_THRESHOLD = 0.5`
- `BEAM_WIDTH = 100`
- `MAX_MOVE_CANDIDATES = 20`
- `maxIterations = 20`

| Stärken | Schwächen |
|---------|-----------|
| ✅ Erkennt komplexe Kombinationen (TWF, Kiting) | ❌ Kein Multi-Turn Lookahead |
| ✅ Resource Management (Spell Slots, Recharge) | ❌ Keine Gruppen-Koordination |
| ✅ OA-Berechnung und -Vermeidung | ❌ Hardcodierte Konstanten |
| ✅ Concentration Tracking | ❌ Viele HACKs dokumentiert |

**Fazit:** Muss nicht ersetzt werden. Kann um `objective`/`personality` Parameter erweitert werden.

### actionScoring.ts - DPR-Scoring

**Scoring-Komponenten (alle auf DPR-Skala):**
```typescript
damageComponent  = hitChance × expectedDamage
controlComponent = enemyDPR × duration × successProb
healingComponent = allyDPR × survivalRoundsGained
buffComponent    = multiplier × duration × allyDPR
```

| Stärken | Schwächen |
|---------|-----------|
| ✅ Gleiche Skala für alle Intents | ❌ Kein AoE-Scoring (TODO) |
| ✅ Base-Values-Caching | ❌ Kein Multi-Target Healing (TODO) |
| ✅ Situational Modifiers Plugin-System | ❌ Nur EV, keine Risk-Betrachtung |
| ✅ Reaction System (OA, Shield, Counterspell) | ❌ Viele hardcodierte Heuristiken |

**Fazit:** Kern-Baustein, beibehalten und erweitern.

### influenceMaps.ts - Layer-System (ersetzt cellPositioning.ts)

**Komponenten:**
- `initializeLayers()`: Combat-Start-Initialisierung aller Profiles mit Layer-Daten
- `getThreatAt()`: Query-Funktion für Threat-Score einer Cell
- `getAvailableActionsAt()`: Query-Funktion für verfügbare Actions von einer Cell
- `resolveAgainstTarget()`: Target-spezifische Resolution (Hit-Chance, Damage PMF)
- `buildEscapeDangerMap()`: Batch-Berechnung für Escape-Danger

| Stärken | Schwächen |
|---------|-----------|
| ✅ Layer-basierte Evaluierung | ❌ Kein Cover-Tracking (TODO) |
| ✅ Pre-computed Action Layers | ❌ Keine Chokepoint-Erkennung (TODO) |
| ✅ Situational Modifiers Integration | ❌ Keine Flanking-Erkennung (TODO) |
| ✅ PHB-Variant Distance (Chebyshev) | |

**Fazit:** ✅ Implementiert. Ersetzt das alte cellPositioning.ts Source-Map-System.

### Was kann verwendet werden? ✅

| Komponente | LOC | Quelle |
|------------|-----|--------|
| DPR-Scoring-Logik | ~600 | `calculatePairScore()`, `computeScoreFromBaseValues()` |
| PMF-basierte Damage-Berechnung | ~200 | `diceExpressionToPMF()`, `getExpectedValue()` |
| Base-Values-Caching | ~200 | `calculateAndCacheBaseValues()` |
| Intent-Erkennung | ~100 | `getActionIntent()` |
| Situational Modifiers | ~300 | `evaluateSituationalModifiers()` |
| Beam Search Framework | ~400 | `expandAndPrune()`, `generateFollowups()` |
| Resource Management | ~200 | `initializeResources()`, `consumeActionResource()` |
| Grid-Utilities | ~150 | `getDistance()`, `getRelevantCells()` |

### Was sollte ersetzt/erweitert werden? ⚠️

| Aktuell | Problem | Lösung | Aufwand |
|---------|---------|--------|---------|
| Cell-Positioning | Punktuelle Scores | [Influence Maps](../research/influence-maps.md) | ~300 LOC |
| Pure EV-Scoring | Keine Risk-Betrachtung | [Expectimax](../research/expectimax.md) | ~600 LOC |
| Isolierte Planung | Kein Focus Fire | Multi-Agent Koordination | ~400 LOC |
| Basic State | Keine kritischen Zustände | State Enrichment | ~200 LOC |

---

**Vision:**
- TPK-Maschine für unvorsichtige Spieler
- Drama-Generator für spannende Kämpfe
- Charaktertreue Simulation für Immersion
- GM-Entlastung durch Automatisierung

---

## Kernkonzept: Combat Objectives

```typescript
type CombatObjective =
  | 'merciless'      // Töte Party so schnell wie möglich
  | 'deadly'         // Kämpfe um zu gewinnen, aber nicht perfekt
  | 'challenging'    // Bring Party auf Ziel-HP%, dann stabilisiere
  | 'dramatic'       // Baue Spannung auf, eskaliere über Zeit
  | 'teaching'       // Bestrafe taktische Fehler
  | 'roleplay'       // Verhalte dich charaktergerecht
```

### Objective-Verhalten

| Objective | Focus Fire | Finish Downed | Optimal Play | Use Case |
|-----------|------------|---------------|--------------|----------|
| **merciless** | 100% | Ja | 100% | BBEG, telegraphed danger |
| **deadly** | 80% | Selten | 80% | Kompetente Gegner |
| **challenging** | 50% | Nein | 60% | Standard-Encounters |
| **dramatic** | 30% | Nein | 40% | Story-Momente |
| **teaching** | Situativ | Nein | Reaktiv | Neue Spieler |
| **roleplay** | Persönlichkeit | Persönlichkeit | Persönlichkeit | Immersion |

---

## Scoring-Funktionen pro Objective

### Merciless: Maximiere Party-Elimination

```typescript
function scoreMerciless(action, target, state): number {
  const damage = expectedDamage(action, target);
  const killPotential = target.hp <= damage ? 1000 : 0;
  const concentrationBreak = target.isConcentrating ? 500 : 0;
  const focusFire = getAlliesTargeting(target).length * 100;

  return damage + killPotential + concentrationBreak + focusFire;
}
```

**Taktiken:**
- Töte Concentrating Caster zuerst (Haste, Bless, etc.)
- Focus Fire: Alle auf ein Ziel bis tot
- Finish Downed: Death Saves beenden
- Block Escape: Verhindere Flucht
- Burn Resources: Nutze alles sofort

### Challenging: Halte Party bei Ziel-HP%

```typescript
function scoreChallenging(action, target, state, targetHP: number): number {
  const currentPartyHP = calculatePartyHPPercent(state);
  const damage = expectedDamage(action, target);

  if (currentPartyHP > targetHP + 10) {
    return damage * 1.5;  // Über Ziel: Aggressiver
  } else if (currentPartyHP < targetHP - 10) {
    return damage * 0.3;  // Unter Ziel: Zurückhalten
  }
  return damage;          // Im Zielbereich: Halten
}
```

### Dramatic: Eskalation über Zeit

```typescript
function scoreDramatic(action, target, state): number {
  const round = state.currentRound;
  const escalation = Math.min(1.5, 0.5 + round * 0.2);
  const base = scoreChallenging(action, target, state, 40);
  return base * escalation;
}
```

### Roleplay: Persönlichkeitsbasiert

```typescript
function scoreRoleplay(action, target, state, personality: CombatPersonality): number {
  let score = expectedDamage(action, target);

  // Target-Präferenz
  switch (personality.targetPriority) {
    case 'weakest':
      if (isLowestHP(target, state)) score *= 2;
      break;
    case 'nearest':
      if (isNearest(target, state)) score *= 2;
      break;
    case 'spellcaster':
      if (target.isSpellcaster) score *= 3;
      break;
    case 'most-threatening':
      if (looksThreatening(target)) score *= 2;
      break;
    case 'wounded':
      if (target.hp < target.maxHp * 0.5) score *= 2;
      break;
  }

  // Aggression
  if (action.isRisky && personality.aggression < 0.3) score *= 0.5;
  if (action.isDefensive && personality.aggression > 0.7) score *= 0.5;

  return score;
}
```

---

## Combat Personality Schema

```typescript
interface CombatPersonality {
  // Wie viel Risiko wird akzeptiert? (0 = feige, 1 = suizidal)
  aggression: number;

  // Was macht ein Ziel attraktiv?
  targetPriority:
    | 'highest-threat'      // Wer macht am meisten Schaden?
    | 'most-threatening'    // Wer SIEHT gefährlich aus?
    | 'weakest'             // Wer ist am leichtesten zu töten?
    | 'nearest'             // Wer ist am nächsten?
    | 'wounded'             // Wer blutet?
    | 'spellcaster'         // Wer castet?
    | 'leader'              // Wer gibt Befehle?

  // Wie wird gekämpft?
  tactics:
    | 'stand-and-fight'     // Stirb wo du stehst
    | 'hit-and-run'         // Angriff + Rückzug
    | 'pack-tactics'        // Koordiniere mit Allies
    | 'ambush'              // Warte auf perfekten Moment
    | 'protect-leader'      // Schütze wichtigste Einheit
    | 'flanking'            // Positioniere für Advantage

  // Wann wird geflohen?
  morale: {
    fleeAtHPPercent: number;
    fleeIfAloneAgainst: number;
    neverFlee: boolean;
  };

  // Wie "gut" sind Entscheidungen? (INT Score)
  tacticalIntelligence: number;
}
```

### Beispiel-Persönlichkeiten

```typescript
const GOBLIN_COWARD: CombatPersonality = {
  aggression: 0.2,
  targetPriority: 'weakest',
  tactics: 'hit-and-run',
  morale: { fleeAtHPPercent: 50, fleeIfAloneAgainst: 2, neverFlee: false },
  tacticalIntelligence: 8,
};

const HOBGOBLIN_SOLDIER: CombatPersonality = {
  aggression: 0.6,
  targetPriority: 'highest-threat',
  tactics: 'flanking',
  morale: { fleeAtHPPercent: 20, fleeIfAloneAgainst: 4, neverFlee: false },
  tacticalIntelligence: 12,
};

const ZEALOT_FANATIC: CombatPersonality = {
  aggression: 1.0,
  targetPriority: 'spellcaster',
  tactics: 'stand-and-fight',
  morale: { fleeAtHPPercent: 0, neverFlee: true },
  tacticalIntelligence: 10,
};

const WOLF_PACK: CombatPersonality = {
  aggression: 0.5,
  targetPriority: 'wounded',
  tactics: 'pack-tactics',
  morale: { fleeAtHPPercent: 30, fleeIfAloneAgainst: 3, neverFlee: false },
  tacticalIntelligence: 3,
};

const ANCIENT_DRAGON: CombatPersonality = {
  aggression: 0.7,
  targetPriority: 'highest-threat',
  tactics: 'flanking',  // Nutzt Flug für Positioning
  morale: { fleeAtHPPercent: 10, neverFlee: false },  // Selbsterhaltung
  tacticalIntelligence: 18,
};
```

---

## Merciless Mode: Taktische Details

Wenn `objective: 'merciless'`, nutzt AI alle verfügbaren Tricks:

```typescript
const MERCILESS_TACTICS = {
  targetSelection: {
    priority: [
      'concentrating-spellcaster',  // Breche Concentration
      'healer',                      // Eliminiere Heilung
      'lowest-hp',                   // Sichere Kills
      'highest-dpr',                 // Eliminiere Damage
    ],
    coordinateFocusFire: true,
    finishDowned: true,              // Death Saves beenden
  },

  positioning: {
    maintainFlanking: true,
    blockEscapeRoutes: true,
    protectRanged: true,
    useChokepointsOffensively: true,
  },

  actionEconomy: {
    grappleToDisable: true,
    shoveProneForAdvantage: true,
    readyActionsForCasters: true,
    chainCrowdControl: true,
  },

  resources: {
    useHighestSlots: true,
    saveLegendaryForKills: true,
    burnDailyAbilities: true,
  },
};
```

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│ CombatDirector                                              │
│   - Encounter-Level Objective                              │
│   - Party HP Tracking                                      │
│   - Dynamische Aggression-Anpassung                        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ PersonalityEngine                                           │
│   - Lädt Creature Personality                              │
│   - Modifiziert Scoring basierend auf Traits               │
│   - Simuliert Moral/Flucht                                 │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ ObjectiveScorer                                             │
│   - Wählt Scoring-Funktion basierend auf Objective         │
│   - Kombiniert mit Personality-Modifiern                   │
│   - Liefert finale Scores an TurnPlanner                   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ TurnPlanner (bestehender Beam Search)                      │
│   - Nutzt ObjectiveScorer statt calculatePairScore()       │
│   - Rest bleibt unverändert                                │
└─────────────────────────────────────────────────────────────┘
```

---

## GM Interface

### Encounter-Level Settings

```typescript
interface EncounterCombatSettings {
  objective: CombatObjective;

  // Für 'challenging'/'dramatic'
  targetPartyHPPercent?: number;  // z.B. 40

  // Overrides pro Creature-Typ
  creatureOverrides?: {
    [creatureId: string]: {
      objective?: CombatObjective;
      personality?: Partial<CombatPersonality>;
    };
  };
}
```

### Mid-Combat Adjustment

```typescript
// GM kann während Combat ändern
function adjustDifficulty(encounterState, newObjective: CombatObjective): void;

// Beispiel: Party struggelt unerwartet
adjustDifficulty(state, 'dramatic');  // Ease off

// Beispiel: Party ist arrogant, braucht Lektion
adjustDifficulty(state, 'merciless'); // Gloves off
```

---

## Implementierungs-Reihenfolge

### Phase 1: Objective Scoring (Basis)

1. `CombatObjective` Type definieren
2. `scoreMerciless()` implementieren
3. `scoreChallenging()` implementieren
4. Integration in bestehenden TurnPlanner

**Dateien:**
- `src/services/combatantAI/objectiveScoring.ts` (NEU)
- `src/types/combat.ts` (erweitern)

### Phase 2: Personality System

1. `CombatPersonality` Schema
2. `scoreRoleplay()` implementieren
3. Personality-Presets für Standard-Monster
4. Morale/Flucht-Logik

**Dateien:**
- `src/types/entities/combatPersonality.ts` (NEU)
- `src/services/combatantAI/personalityEngine.ts` (NEU)
- `presets/personalities/` (NEU)

### Phase 3: Combat Director

1. Party HP Tracking
2. Dynamische Aggression-Anpassung
3. Mid-Combat Objective Changes
4. GM Interface Integration

**Dateien:**
- `src/services/combatantAI/combatDirector.ts` (NEU)
- `src/workflows/combatWorkflow.ts` (erweitern)

### Phase 4: Advanced Tactics (Merciless)

1. Focus Fire Koordination
2. Finish Downed Logic
3. CC-Chaining
4. Escape-Blocking

---

## Integration mit bestehendem Code

### Änderungen an actionScoring.ts

```typescript
// VORHER
export function calculatePairScore(
  profile: CombatProfile,
  action: Action,
  target: CombatProfile,
  distance: number,
  state: SimulationState
): { score: number; ... } | null;

// NACHHER: Neuer Parameter
export function calculatePairScore(
  profile: CombatProfile,
  action: Action,
  target: CombatProfile,
  distance: number,
  state: SimulationState,
  objective?: CombatObjective,       // NEU
  personality?: CombatPersonality    // NEU
): { score: number; ... } | null;
```

### Änderungen an turnExecution.ts

```typescript
// VORHER
export function executeTurn(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget
): TurnExplorationResult;

// NACHHER: Neue Parameter
export function executeTurn(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget,
  objective?: CombatObjective,       // NEU
  personality?: CombatPersonality    // NEU
): TurnExplorationResult;
```

---

## Test-Szenarien

### Scenario 1: Merciless vs Party

```typescript
{
  name: 'merciless-focus-fire',
  objective: 'merciless',
  setup: {
    enemies: [{ id: 'hobgoblin-captain' }, { id: 'hobgoblin' }, { id: 'hobgoblin' }],
    party: [{ id: 'wizard', hp: 22, concentrating: 'haste' }, { id: 'fighter', hp: 45 }],
  },
  expected: {
    allTargetWizard: true,  // Focus Fire auf Caster
    breakConcentration: true,
  },
}
```

### Scenario 2: Challenging HP Target

```typescript
{
  name: 'challenging-hp-regulation',
  objective: 'challenging',
  targetPartyHP: 40,
  setup: {
    enemies: [{ id: 'ogre' }],
    party: [{ id: 'fighter', hp: 45, maxHp: 45 }],  // 100% HP
  },
  rounds: [
    { round: 1, expectedAggression: 'high' },     // Party bei 100%
    { round: 3, partyHPPercent: 45, expectedAggression: 'medium' },
    { round: 5, partyHPPercent: 35, expectedAggression: 'low' },
  ],
}
```

### Scenario 3: Roleplay Coward

```typescript
{
  name: 'goblin-flees',
  objective: 'roleplay',
  personality: GOBLIN_COWARD,
  setup: {
    enemies: [{ id: 'goblin', hp: 4, maxHp: 7 }],  // ~57% HP
    party: [{ id: 'fighter' }, { id: 'fighter' }],  // 2 Gegner
  },
  expected: {
    action: 'flee',  // HP < 50% UND allein gegen 2
  },
}
```

---

## Offene Design-Fragen

1. **Personality Inheritance:** Sollen Creature-Typen Default-Personalities haben? (z.B. alle Goblins sind feige)

2. **Party Awareness:** Soll AI wissen welche PCs Spellcaster sind, oder nur "sichtbare" Merkmale nutzen?

3. **Learning:** Soll AI aus vorherigen Runden lernen? ("Fighter macht viel Schaden → Priorisiere ihn")

4. **Coordination Cost:** Wie teuer ist Gruppen-Koordination für niedrig-INT Kreaturen?

---

---

## Technische Bausteine für intelligente AI

Die Objectives und Personalities definieren das **Ziel**, aber nicht den **Weg**. Hier sind die technischen Bausteine um AI intelligent genug zu machen:

### Baustein 1: State Awareness (Aufwand: Gering)

**Problem:** AI weiß nicht was "wichtig" ist (Concentration, Low HP, Conditions).

**Lösung:** Enriched State mit kritischen Zuständen.

```typescript
interface EnrichedCombatState {
  // Bestehend
  profiles: CombatProfile[];

  // NEU: Kritische Zustände
  concentratingTargets: {
    profileId: string;
    spell: string;
    value: number;  // Wie wertvoll ist dieser Effekt?
  }[];

  lowHPTargets: {
    profileId: string;
    hp: number;
    expectedDamageToKill: number;
  }[];

  disabledTargets: {
    profileId: string;
    condition: string;  // Paralyzed, Stunned, Prone
    turnsRemaining: number;
  }[];

  // NEU: Terrain-Features
  chokepoints: GridPosition[];
  coverPositions: { cell: GridPosition; coverLevel: 'half' | 'three-quarters' }[];
}
```

**Scoring mit State-Bonuses:**

```typescript
function scoreWithStateAwareness(action, target, state: EnrichedCombatState): number {
  let score = baseDamage(action, target);

  // Concentration Breaking Bonus
  const concentration = state.concentratingTargets.find(c => c.profileId === target.id);
  if (concentration) {
    score += concentration.value * 0.5;
  }

  // Kill Securing Bonus
  const lowHP = state.lowHPTargets.find(l => l.profileId === target.id);
  if (lowHP && expectedDamage(action, target) >= lowHP.hp) {
    score += 500;  // Massive bonus für sichere Kills
  }

  // Disabled Target Bonus (auto-crit auf Paralyzed)
  const disabled = state.disabledTargets.find(d => d.profileId === target.id);
  if (disabled?.condition === 'paralyzed') {
    score *= 2;
  }

  return score;
}
```

**Aufwand:** ~200 LOC, funktioniert mit bestehender Beam Search.

---

### Baustein 2: Tactical Patterns (Aufwand: Mittel)

**Problem:** Beam Search berechnet alles, erkennt aber keine Situationen.

**Lösung:** Pattern-Recognizer mit Strategy-Templates.

```typescript
interface TacticalPattern {
  name: string;
  recognizer: (state: EnrichedCombatState, profile: CombatProfile) => boolean;
  strategy: (state: EnrichedCombatState, profile: CombatProfile) => TurnPlan;
}

const PATTERNS: TacticalPattern[] = [
  {
    name: 'kill-secure',
    recognizer: (state, profile) =>
      state.lowHPTargets.some(t => canKillThisTurn(profile, t)),
    strategy: (state, profile) => planKillSecure(profile, state),
  },

  {
    name: 'break-concentration',
    recognizer: (state, profile) =>
      state.concentratingTargets.some(c => c.value > 50 && canReach(profile, c.profileId)),
    strategy: (state, profile) => planConcentrationBreak(profile, state),
  },

  {
    name: 'hold-chokepoint',
    recognizer: (state, profile) =>
      state.chokepoints.some(cp => isNearChokepoint(profile.position, cp)),
    strategy: (state, profile) => planHoldPosition(profile, state),
  },

  {
    name: 'cc-chain',
    recognizer: (state, profile) =>
      state.disabledTargets.some(d => d.turnsRemaining === 1 && hasCC(profile)),
    strategy: (state, profile) => planCCRefresh(profile, state),
  },

  {
    name: 'default',
    recognizer: () => true,
    strategy: (state, profile) => executeTurnBeamSearch(profile, state),
  },
];
```

**Aufwand:** ~500 LOC, modular erweiterbar.

---

### Baustein 3: Multi-Agent Koordination (Aufwand: Mittel)

**Problem:** Jeder Combatant plant isoliert. Keine Focus Fire.

**Lösung:** Intention Broadcasting vor Turn-Planung.

```typescript
interface TurnIntention {
  actorId: string;
  targetId: string | null;
  expectedDamage: number;
  position: GridPosition;
}

function planGroupTurn(group: CombatProfile[], state: SimulationState): TurnIntention[] {
  const intentions: TurnIntention[] = [];

  for (const profile of group) {
    const stateWithIntentions = {
      ...state,
      alliedIntentions: intentions,  // Wer greift schon wen an?
    };

    const plan = executeTurn(profile, stateWithIntentions, budget);
    intentions.push(extractIntention(plan));
  }

  return intentions;
}

function scoreWithCoordination(action, target, state): number {
  let score = baseDamage(action, target);

  // Focus Fire Bonus
  const alliesTargetingSame = state.alliedIntentions.filter(i => i.targetId === target.id);
  if (alliesTargetingSame.length > 0) {
    const totalIncoming = alliesTargetingSame.reduce((sum, i) => sum + i.expectedDamage, 0);
    const myDamage = expectedDamage(action, target);

    if (totalIncoming + myDamage >= target.hp) {
      score += 300;  // Kill Securing Bonus
    } else {
      score += 100 * alliesTargetingSame.length;
    }
  }

  // Flanking Bonus
  const alliesAdjacentToTarget = state.alliedIntentions.filter(i =>
    i.targetId === target.id && getDistance(i.position, target.position) <= 1
  );
  if (alliesAdjacentToTarget.length > 0 && action.actionType === 'melee-weapon') {
    score += 150;
  }

  return score;
}
```

**Aufwand:** ~400 LOC, erfordert Änderung der Turn-Order-Logik.

---

### Baustein 4: Multi-Turn Lookahead (Aufwand: Hoch)

**Problem:** Beam Search plant nur 1 Turn.

**Lösung:** Shallow Lookahead mit Depth 2-3.

```typescript
function planWithLookahead(profile, state, budget, depth: number = 2): TurnPlan {
  if (depth === 0) {
    return executeTurnBeamSearch(profile, state, budget);
  }

  const candidates = generateTopCandidates(profile, state, budget, 10);

  const evaluated = candidates.map(candidate => {
    const stateAfterMyTurn = applyTurnPlan(state, candidate);
    const stateAfterEnemies = simulateEnemyTurns(stateAfterMyTurn);

    const nextTurnValue = planWithLookahead(
      profile, stateAfterEnemies, resetBudget(profile), depth - 1
    ).totalValue;

    return {
      ...candidate,
      totalValue: candidate.immediateValue + nextTurnValue * 0.8,
    };
  });

  return evaluated.sort((a, b) => b.totalValue - a.totalValue)[0];
}
```

**Aufwand:** ~600 LOC, signifikante Performance-Kosten.

---

### Empfohlene Implementierungs-Reihenfolge

```
Phase 0: Performance Fixes (Voraussetzung)
   ↓
Phase 1: State Awareness (~200 LOC)
   → Einzelne Combatants werden "smarter"
   ↓
Phase 2: Tactical Patterns (~500 LOC)
   → Combatants reagieren auf Situationen
   ↓
Phase 3: Multi-Agent Koordination (~400 LOC)
   → Gruppen arbeiten zusammen
   ↓
Phase 4: Multi-Turn Lookahead (~600 LOC, optional)
   → Langfristige Planung
```

### Komplexitäts-Matrix

| Feature | Aufwand | Performance | Intelligenz-Gewinn |
|---------|---------|-------------|-------------------|
| State Awareness | Gering | Minimal | Hoch |
| Tactical Patterns | Mittel | Minimal | Sehr Hoch |
| Multi-Agent Koordination | Mittel | Mittel | Hoch |
| Multi-Turn Lookahead | Hoch | Hoch | Mittel |

**Empfehlung:** State Awareness + Tactical Patterns geben 80% des Intelligenz-Gewinns für 30% des Aufwands.

---

## Alternative AI-Architekturen

Die bisherigen Bausteine basieren auf **Utility AI** (Scoring-Funktionen). Hier sind alternative Architekturen aus der Game-AI-Forschung, die für den Combat Director relevant sein könnten:


### Monte Carlo Tree Search (MCTS)

> Bekannt durch AlphaGo (2016), verwendet in Total War: Rome II für strategische AI.

**Konzept:** Statt alle Möglichkeiten zu berechnen, simuliert MCTS zufällige Spielverläufe (Playouts) und bewertet Züge nach Erfolgsquote.

**UCT-Algorithmus (Upper Confidence Bound for Trees):**

```typescript
// MCTS Node
interface MCTSNode {
  action: Action | null;
  visits: number;
  totalValue: number;
  children: MCTSNode[];
  parent: MCTSNode | null;
}

// UCT Selection: Balance zwischen Exploitation und Exploration
function selectChild(node: MCTSNode, explorationConstant: number = 1.41): MCTSNode {
  return node.children.reduce((best, child) => {
    const exploitation = child.totalValue / child.visits;
    const exploration = explorationConstant * Math.sqrt(
      Math.log(node.visits) / child.visits
    );
    const ucb = exploitation + exploration;
    return ucb > bestUCB ? child : best;
  });
}

// MCTS Main Loop
function mcts(state: SimulationState, iterations: number): Action {
  const root = createNode(null, state);

  for (let i = 0; i < iterations; i++) {
    // 1. Selection: UCT bis Leaf
    let node = selectLeaf(root);

    // 2. Expansion: Neue Kindknoten
    if (!isTerminal(node)) {
      node = expand(node);
    }

    // 3. Simulation: Random Playout bis Ende
    const value = simulate(node.state);

    // 4. Backpropagation: Werte hochreichen
    backpropagate(node, value);
  }

  return getBestChild(root).action;
}
```

**Vorteile:**
- Funktioniert ohne Heuristik-Finetuning
- Skaliert gut mit mehr Rechenzeit
- Natürlicher Umgang mit Stochastik (Würfelwürfe)

**Nachteile:**
- Hoher CPU-Verbrauch (1000+ Iterationen für gute Ergebnisse)
- Schwierig für Echtzeit-Entscheidungen
- Kann in taktischen Feinheiten versagen

**Empfehlung:** Alternative zu Baustein 4 (Multi-Turn Lookahead). Besonders interessant für Boss-Kämpfe mit hohem Stakes, wo längere Berechnungszeit akzeptabel ist.

**Quellen:**
- [Monte Carlo Tree Search: A New Framework for Game AI](https://sander.landofsand.com/publications/AIIDE08_Chaslot.pdf)
- [Game AI Pro 3: Pitfalls and Solutions for MCTS](http://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter28_Pitfalls_and_Solutions_When_Using_Monte_Carlo_Tree_Search_for_Strategy_and_Tactical_Games.pdf)

---

### Hierarchical Task Networks (HTN)

> Verwendet in Horizon Zero Dawn, Killzone, Elder Scrolls IV: Oblivion.

**Konzept:** High-Level-Tasks werden rekursiv in Primitives zerlegt. Schneller als GOAP, weil keine Heuristik-Suche nötig.

```typescript
// HTN Task Types
type Task = PrimitiveTask | CompoundTask;

interface PrimitiveTask {
  type: 'primitive';
  name: string;
  execute: (state: SimulationState) => void;
}

interface CompoundTask {
  type: 'compound';
  name: string;
  methods: Method[];  // Alternative Zerlegungen
}

interface Method {
  preconditions: (state: SimulationState) => boolean;
  subtasks: Task[];
}

// Beispiel: "Eliminate Target" Task
const eliminateTarget: CompoundTask = {
  type: 'compound',
  name: 'eliminate-target',
  methods: [
    {
      // Method 1: Ranged Attack
      preconditions: (s) => hasRangedWeapon(s) && hasLineOfSight(s),
      subtasks: [
        { type: 'primitive', name: 'aim', execute: aim },
        { type: 'primitive', name: 'shoot', execute: shoot },
      ],
    },
    {
      // Method 2: Melee Attack
      preconditions: (s) => hasMeleeWeapon(s),
      subtasks: [
        { type: 'primitive', name: 'move-to-melee-range', execute: moveToMelee },
        { type: 'primitive', name: 'melee-attack', execute: meleeAttack },
      ],
    },
    {
      // Method 3: Retreat and regroup
      preconditions: (s) => isLowHP(s) && hasAllies(s),
      subtasks: [
        { type: 'primitive', name: 'retreat', execute: retreat },
        { type: 'primitive', name: 'call-for-help', execute: callAllies },
      ],
    },
  ],
};
```

**Vorteile:**
- Sehr schnelle Planung (kein A*, kein Sorting)
- Natürliche Hierarchie ("Attack" → "Aim" → "Shoot")
- Gut debugbar durch klare Struktur

**Nachteile:**
- Weniger adaptiv als GOAP (vordefinierte Methods)
- Kann keine emergenten Combos entdecken
- Mehr Authoring-Aufwand für Methods

**Empfehlung:** Ideal für Gruppen-Koordination (Baustein 3). "protect-leader" und "pack-tactics" lassen sich als CompoundTasks elegant modellieren.

**Quellen:**
- [HTN Planning in Decima (Guerrilla Games)](https://www.guerrilla-games.com/read/htn-planning-in-decima)
- [Game AI Pro: Exploring HTN Planners](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter12_Exploring_HTN_Planners_through_Example.pdf)

---

### Influence Maps

> Standard-Technik seit RTS-Spielen der 90er, verwendet in modernen Shootern für taktische Positionierung.

**Konzept:** Grid-basierte Heatmaps für räumliche Entscheidungen. Verschiedene Layer (Gefahr, Sichtbarkeit, Kontrolle) werden kombiniert.

```typescript
// Influence Map Layer
interface InfluenceLayer {
  name: string;
  grid: number[][];  // Werte 0-1 normalisiert
  decayRate: number; // Wie schnell Einfluss abklingt
}

// Standard-Layer für Combat
const COMBAT_LAYERS = {
  // Wo sind Feinde? (hoher Wert = gefährlich)
  enemyThreat: createLayer('enemy-threat', 0.7),

  // Wo sind Allies? (hoher Wert = sicher)
  allySupport: createLayer('ally-support', 0.5),

  // Sichtlinien (hoher Wert = gut sichtbar)
  visibility: createLayer('visibility', 0.3),

  // Cover-Positionen (hoher Wert = gute Deckung)
  cover: createLayer('cover', 0.9),
};

// Update Enemy Threat Layer
function updateEnemyThreat(layer: InfluenceLayer, enemies: CombatProfile[]): void {
  for (const enemy of enemies) {
    const { x, y } = enemy.position;
    const range = enemy.threatRange;

    // Propagiere Einfluss mit Decay
    propagateInfluence(layer, x, y, 1.0, range, layer.decayRate);
  }
}

// Kombiniere Layer für Positionsentscheidung
function evaluatePosition(pos: GridPosition, objective: 'aggressive' | 'defensive'): number {
  const threat = COMBAT_LAYERS.enemyThreat.grid[pos.x][pos.y];
  const support = COMBAT_LAYERS.allySupport.grid[pos.x][pos.y];
  const cover = COMBAT_LAYERS.cover.grid[pos.x][pos.y];

  if (objective === 'aggressive') {
    // Näher an Feinden, weniger Cover wichtig
    return threat * 0.5 + support * 0.3 - cover * 0.2;
  } else {
    // Weg von Feinden, Cover priorisieren
    return -threat * 0.5 + support * 0.3 + cover * 0.4;
  }
}
```

**Update-Frequenz:**
- Strategische Maps: 0.5-1 Hz (alle 1-2 Sekunden)
- Taktische Maps: 2-5 Hz (mehrmals pro Sekunde)
- Für Rundenbasiert: Einmal pro Runde ausreichend

**Vorteile:**
- Extrem effizient (O(n) Grid-Operationen)
- Intuitive Visualisierung für Debugging
- Kombinierbar mit jedem AI-System

**Nachteile:**
- Memory-Overhead für Grid
- Diskretisierung verliert Präzision
- Muss korrekt getuned werden

**Empfehlung:** ✅ Bereits in `influenceMaps.ts` implementiert. Ermöglicht "Hold Chokepoint", "Block Escape Routes", "Flanking" ohne komplexe Geometrie-Berechnung.

**Quellen:**
- [Game AI Pro 2: Modular Tactical Influence Maps](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf)
- [Influence Mapping Core Mechanics (GameDev.net)](https://www.gamedev.net/tutorials/programming/artificial-intelligence/the-core-mechanics-of-influence-mapping-r2799/)

---

### Hybrid: Utility + Behavior Trees (GOBT)

> Kombination aus strukturierter Ausführung (BT) und dynamischer Priorisierung (Utility). Verwendet in Killzone 2.

**Konzept:** Behavior Tree für die **Ausführung**, Utility-Scoring für die **Selektion**.

```typescript
// Behavior Tree Node Types
type BTNode = SelectorNode | SequenceNode | ActionNode | UtilityNode;

interface SelectorNode {
  type: 'selector';
  children: BTNode[];  // Versuche der Reihe nach
}

interface SequenceNode {
  type: 'sequence';
  children: BTNode[];  // Alle müssen erfolgreich sein
}

interface ActionNode {
  type: 'action';
  execute: () => 'success' | 'failure' | 'running';
}

// NEU: Utility Node für dynamische Selektion
interface UtilityNode {
  type: 'utility-selector';
  children: { node: BTNode; scorer: (state: SimulationState) => number }[];
}

// Beispiel: Combat Behavior Tree
const combatBehavior: BTNode = {
  type: 'utility-selector',
  children: [
    {
      node: createSequence([checkCanKill, executeKillSecure]),
      scorer: (state) => scoreKillOpportunity(state),
    },
    {
      node: createSequence([checkConcentration, executeConcentrationBreak]),
      scorer: (state) => scoreConcentrationBreak(state),
    },
    {
      node: createSequence([checkLowHP, executeRetreat]),
      scorer: (state) => scoreSelfPreservation(state),
    },
    {
      node: createSequence([executeStandardAttack]),
      scorer: () => 0.5,  // Default fallback
    },
  ],
};
```

**Vorteile:**
- Beste aus beiden Welten: Struktur + Flexibilität
- Einfacher zu debuggen als reines Utility
- Modular erweiterbar

**Nachteile:**
- Komplexere Architektur
- Scoring muss mit BT-Struktur abgestimmt werden

**Empfehlung:** Gute Option wenn Debugbarkeit wichtig ist. Die `roleplay` und `teaching` Objectives profitieren von klarer Struktur.

**Quellen:**
- [Game AI Planning: GOAP, Utility, and Behavior Trees](https://tonogameconsultants.com/game-ai-planning/)
- [GOBT: Goal-Oriented and Utility-Based Planning in Behavior Trees](https://www.jmis.org/archive/view_article?pid=jmis-10-4-321)

---

### Expectimax für D&D-Würfelmechanik

> Variante von Minimax für stochastische Spiele. Optimal für Spiele mit Zufallselementen wie Würfelwürfe.

**Konzept:** Neben MIN und MAX Nodes gibt es CHANCE Nodes, die den Erwartungswert über mögliche Würfelergebnisse berechnen.

```typescript
// Expectimax Node Types
type ExpectiNode = MaxNode | ChanceNode | TerminalNode;

interface MaxNode {
  type: 'max';
  children: ExpectiNode[];
}

interface ChanceNode {
  type: 'chance';
  outcomes: { probability: number; node: ExpectiNode }[];
}

interface TerminalNode {
  type: 'terminal';
  value: number;
}

// Expectimax für D20-Angriff
function evaluateAttack(
  attacker: CombatProfile,
  target: CombatProfile,
  action: Action
): number {
  const toHit = attacker.attackBonus + (action.attackModifier ?? 0);
  const targetAC = target.ac;
  const needToRoll = targetAC - toHit;

  // Chance Node: Alle möglichen d20-Ergebnisse
  let expectedValue = 0;

  for (let roll = 1; roll <= 20; roll++) {
    const probability = 1 / 20;

    if (roll === 1) {
      // Critical Miss
      expectedValue += probability * 0;
    } else if (roll === 20) {
      // Critical Hit
      expectedValue += probability * (action.damage * 2);
    } else if (roll >= needToRoll) {
      // Hit
      expectedValue += probability * action.damage;
    } else {
      // Miss
      expectedValue += probability * 0;
    }
  }

  return expectedValue;
}

// Integration mit bestehendem PMF-System
function evaluateWithPMF(action: Action, target: CombatProfile): number {
  // Nutze bestehende PMF-Utilities aus src/utils/probability/pmf.ts
  const damagePMF = calculateDamagePMF(action, target);
  return pmfExpectedValue(damagePMF);
}
```

**Alpha-Beta Pruning für Expectimax:**

Mit begrenzten Evaluation-Ranges ist Pruning auch für Chance-Nodes möglich:

```typescript
function expectimaxWithPruning(
  node: ExpectiNode,
  alpha: number,
  beta: number,
  evalMin: number,  // Minimaler möglicher Wert
  evalMax: number   // Maximaler möglicher Wert
): number {
  if (node.type === 'terminal') return node.value;

  if (node.type === 'chance') {
    let value = 0;
    let probRemaining = 1;

    for (const outcome of node.outcomes) {
      const childValue = expectimaxWithPruning(
        outcome.node, alpha, beta, evalMin, evalMax
      );
      value += outcome.probability * childValue;
      probRemaining -= outcome.probability;

      // Pruning: Selbst bei besten/schlechtesten Ergebnissen
      // kann der Wert nicht mehr relevant werden
      const optimisticBound = value + probRemaining * evalMax;
      const pessimisticBound = value + probRemaining * evalMin;

      if (pessimisticBound >= beta || optimisticBound <= alpha) {
        break;  // Prune
      }
    }
    return value;
  }

  // MAX Node
  let value = -Infinity;
  for (const child of node.children) {
    value = Math.max(value, expectimaxWithPruning(child, alpha, beta, evalMin, evalMax));
    alpha = Math.max(alpha, value);
    if (value >= beta) break;
  }
  return value;
}
```

**Vorteile:**
- Mathematisch korrekte Behandlung von Würfelwürfen
- Integration mit bestehenden PMF-Utilities
- Optimal für D&D's d20-System

**Nachteile:**
- Hoher Branching-Faktor bei vielen Würfelwürfen
- Depth-Limitierung notwendig

**Empfehlung:** Perfekte Ergänzung zum bestehenden PMF-basierten Difficulty-System. Ermöglicht "risikofreudige" vs. "konservative" Entscheidungen basierend auf Wahrscheinlichkeiten.

**Quellen:**
- [Expectimax Search Algorithm (Baeldung)](https://www.baeldung.com/cs/expectimax-search)
- [Stanford CS221: Games](https://web.stanford.edu/class/archive/cs/cs221/cs221.1186/lectures/games1.pdf)

---

### Deep Reinforcement Learning (Langzeit-Option)

> AlphaGo, OpenAI Five, DeepMind StarCraft II. State-of-the-art für komplexe Spielumgebungen.

**Konzept:** Neuronale Netze lernen durch Selbstspiel optimale Strategien.

```typescript
// Konzeptuell (nicht für Plugin-Implementierung)
interface DQNAgent {
  network: NeuralNetwork;
  replayMemory: Experience[];

  // Zustand → Q-Werte für alle Aktionen
  predict(state: GameState): Map<Action, number>;

  // Training aus Erfahrung
  train(batch: Experience[]): void;
}

interface Experience {
  state: GameState;
  action: Action;
  reward: number;
  nextState: GameState;
  done: boolean;
}
```

**Warum NICHT für Salt Marcher:**
1. **Training-Daten:** Benötigt Millionen von Spielen
2. **Infrastruktur:** GPU-Training, Model-Deployment
3. **Debugging:** Black-Box, schwer nachvollziehbar
4. **Determinismus:** GM will vorhersagbares Verhalten

**Wann interessant:**
- Externes Training-Tool für Personality-Presets
- Research-Projekt für "perfekte" AI
- Cloud-basierter Companion-Service

**Quellen:**
- [Playing Atari with Deep Reinforcement Learning (DeepMind)](https://www.cs.toronto.edu/~vmnih/docs/dqn.pdf)
- [Survey of Deep RL in Video Games](https://arxiv.org/pdf/1912.10944)

---

## Entscheidungsmatrix: AI-Architekturen

> **Bewertet nach Rahmenbedingungen:** GM-in-the-Loop, <1s/Turn Budget, Schema-Erweiterbarkeit
> **Detaillierte Reports:** [docs/research/](../research/)

| Architektur | LOC | Performance | Adaptivität | Debugbarkeit | Schema-Fit | Eignung |
|-------------|-----|-------------|-------------|--------------|------------|---------|
| **Utility AI** (aktuell) | — | <50ms | Mittel | Hoch | ⭐⭐⭐⭐⭐ | ✅ Empfohlen |
| **[Influence Maps](../research/influence-maps.md)** | ~300 | <30ms | Niedrig | Sehr Hoch | ⭐⭐⭐⭐⭐ | ✅ Empfohlen |
| **[Expectimax](../research/expectimax.md)** | ~600 | <200ms | Mittel | Hoch | ⭐⭐⭐⭐⭐ | ✅ Empfohlen |
| **[MCTS](../research/mcts.md)** | ~1150 | 750-1000ms | Hoch | Mittel | ⭐⭐⭐⭐ | ⚠️ Bedingt* |
| **[HTN](../research/htn.md)** | ~500 | <100ms | Mittel | Sehr Hoch | ⭐⭐⭐⭐ | ⚠️ Ergänzung** |
| **[GOBT](../research/gobt.md)** | ~2070 | <100ms | Hoch | Sehr Hoch | ⭐⭐⭐ | ❌ Ungeeignet |
| **Deep RL** | — | N/A | Sehr Hoch | Sehr Niedrig | ⭐ | ❌ Ungeeignet |

**Legende:**
- ✅ Empfohlen: Beste Kosten/Nutzen-Verhältnis für Phase 1-2
- ⚠️ Bedingt: Erfüllt Rahmenbedingungen, aber mit Einschränkungen
- ❌ Ungeeignet: Verstößt gegen Rahmenbedingungen

**Fußnoten:**
- \* **MCTS:** 750-1000ms knapp am 800ms/Kreatur Budget. Nur für Boss-Kämpfe oder als optionaler "Deep Think" Modus.
- \*\* **HTN:** Nicht als Ersatz für Beam Search, sondern als Ergänzung für Goal-basiertes Verhalten (roleplay, dramatic).
- \*\*\* **GOBT:** Hoher Aufwand (~2070 LOC) rechtfertigt sich nur bei komplexen Multi-Step Sequenzen oder >10 Personality-Typen.

**Entfernt aus Evaluation:**
- **GOAP:** 50-800× langsamer als Beam Search durch WorldState-Explosion. D&D's dynamische Actions (PMF-basiert, target-abhängig) passen nicht zum statischen Precondition-Modell.

### Empfohlene Kombinationen

> Alle Kombinationen erfüllen: <1s/Turn Budget, Schema-basiert, GM-in-the-Loop
> LOC-Schätzungen aus [detaillierten Research-Reports](../research/)

**Minimal (80/20 Regel) - Empfohlen für Phase 1:**
```
Utility AI (bestehend) + Influence Maps
├─ Aufwand: ~300 LOC (nur Influence Maps)
├─ Performance: <100ms/Turn
├─ Utility AI: Action-Selection über Schema-Attribute
└─ Influence Maps: Positioning (Threat, Cover, Flanking)

Output für GM:
  "Goblin A → Attacks Fighter (Shortbow, 80ft)"
  "Reason: Lowest HP target in range, staying behind cover"
```

**Balanced - Empfohlen für Phase 2:**
```
Utility AI + Influence Maps + Expectimax
├─ Aufwand: ~900 LOC (300 + 600)
├─ Performance: <300ms/Turn
├─ Expectimax: Integriert mit bestehenden PMF-Utilities
└─ Ermöglicht: "Risky vs Safe" Entscheidungen

Output für GM:
  "Dragon → Breath Weapon (Cone, 60ft)"
  "Reason: 75% chance to hit 3 targets, expected damage 42"
  "Alternative: Bite (safer, single target, 18 damage)"
```

**Advanced - Phase 3 Option A (Gruppen-Koordination):**
```
+ HTN für Goal-basiertes Verhalten
├─ Zusätzlicher Aufwand: ~500 LOC
├─ Gesamt: ~1400 LOC
├─ Performance: <400ms/Turn
├─ HTN: Gruppen-Koordination (Focus Fire, Protect Leader)
└─ Ermöglicht: Koordinierte Multi-Creature Vorschläge

Output für GM:
  "Hobgoblin Squad koordiniert Focus Fire auf Wizard:"
  "  - Captain: Move + Attack (Longsword)"
  "  - Soldier A: Move to flank + Attack (advantage)"
  "  - Soldier B: Ready action for when Wizard moves"
```

**Advanced - Phase 3 Option B (Tiefe Suche):**
```
+ MCTS statt HTN
├─ Zusätzlicher Aufwand: ~1150 LOC
├─ Gesamt: ~2050 LOC
├─ Performance: 750-1000ms/Turn (knapp am Budget!)
├─ MCTS: Multi-Turn Lookahead (2-3 Runden voraus)
└─ Ermöglicht: Langfristige Strategie, Setup-Moves

Output für GM:
  "Lich → Casts Wall of Force (isolates Fighter)"
  "Reason: Looking 2 turns ahead - next turn Fireball on
   isolated group deals 84 expected damage vs 28 now"
  "Confidence: 73% win rate in 800 simulations"

⚠️ Nur für Boss-Kämpfe oder optionaler "Deep Think" Modus
```

**❌ Nicht empfohlen:**
```
GOAP (Goal-Oriented Action Planning)
├─ 50-800× langsamer als Beam Search
├─ WorldState-Explosion bei D&D's 40+ Effect-Typen
├─ Target-spezifische Actions passen nicht zu statischem Modell
└─ Siehe detaillierte Analyse warum GOAP nicht passt

Deep Reinforcement Learning
├─ GPU-Training erforderlich
├─ Nicht Schema-erweiterbar (hardcoded network)
├─ Black-Box: GM kann Entscheidungen nicht nachvollziehen
└─ Millionen Trainingsspiele nötig
```

---

## Abgrenzung zu Performance-Handoff

| Aspekt | Performance-Handoff | Dieses Handoff |
|--------|--------------------|--------------------|
| **Ziel** | Bugs fixen | Features hinzufügen |
| **Priorität** | Hoch (blockiert) | Mittel (nach Fixes) |
| **Scope** | turnExecution.ts | Neues Modul |
| **Abhängigkeit** | Keine | Performance-Fixes |

**Wichtig:** Dieses Konzept setzt voraus, dass der Beam Search stabil läuft. Erst Performance-Fixes, dann Combat Director.

# Combat Director: Einheitliche Architektur

> **Status:** Architektur-Spezifikation
> **Datum:** 2026-01-05
> **Basis:** XCOM-Style Movement Maps + Utility Scoring
> **Validiert durch:** GDC 2013 AI Postmortems, Game AI Pro 2

---

## 1. Kern-Konzept

Der Combat Director basiert auf einem **XCOM-inspirierten Zwei-Stufen-System**:

```
┌─────────────────────────────────────────────────────────────┐
│                    COMBAT DIRECTOR                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STUFE 1: MOVEMENT (Influence Map)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Für jede erreichbare Position berechne:             │   │
│  │                                                      │   │
│  │  position_score = Σ(layer[cell] × weight)           │   │
│  │                                                      │   │
│  │  Layer:                                              │   │
│  │  ├─ THREAT   (Feind-Gefahr, negativ)                │   │
│  │  ├─ TARGET   (Ziel-Attraktivität)                   │   │
│  │  ├─ COVER    (Deckungsbonus)                        │   │
│  │  ├─ FLANK    (Flanking-Potenzial)                   │   │
│  │  └─ SUPPORT  (Verbündeten-Nähe)                     │   │
│  │                                                      │   │
│  │  → Wähle Position mit MAX(position_score)           │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  STUFE 2: ACTION (Utility Scoring)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Für jede verfügbare Aktion berechne:                │   │
│  │                                                      │   │
│  │  action_score = target_value × expected_damage      │   │
│  │                 × ability_modifier                   │   │
│  │                                                      │   │
│  │  Target Value basiert auf:                          │   │
│  │  ├─ Hit-Chance (Cover, Flank, Range)                │   │
│  │  ├─ HP-Remaining (Kill-Secure Bonus)                │   │
│  │  ├─ Threat-Level (gefährliche Ziele priorisieren)   │   │
│  │  └─ Special (Concentration, Ability-Synergy)        │   │
│  │                                                      │   │
│  │  → Wähle Aktion mit MAX(action_score)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Influence Map Layer

### 2.1 Layer-Definitionen

| Layer | Beschreibung | Berechnung | Decay |
|-------|--------------|------------|-------|
| **THREAT** | Feind-Gefährdung pro Cell | Σ(enemy_dpr × distance_decay) | 0.7 |
| **TARGET** | Ziel-Attraktivität | Σ(target_value × distance_decay) | 0.8 |
| **COVER** | Deckungsbonus | terrain.coverValue (Half=0.5, Full=1.0) | 0.9 |
| **FLANK** | Flanking-Positionen | isFlankPosition(cell, enemies) ? 1.0 : 0.0 | - |
| **SUPPORT** | Verbündeten-Nähe | Σ(ally_healing_potential × distance_decay) | 0.6 |

### 2.2 Layer-Berechnung

```typescript
interface InfluenceLayer {
  name: string;
  grid: Map<string, number>;  // positionKey → value [0-1]
  decayRate: number;
}

function buildThreatLayer(
  cells: GridPosition[],
  enemies: CombatProfile[],
  viewer: CombatProfile
): InfluenceLayer {
  const layer = createEmptyLayer('threat', cells, 0.7);

  for (const enemy of enemies) {
    if (isHostile(viewer, enemy)) {
      // Threat-Strength basiert auf DPR
      const dpr = estimateDamagePotential(enemy.actions);
      const strength = Math.min(1.0, dpr / 30);  // 30 DPR = max
      const range = getMaxAttackRange(enemy);

      propagateInfluence(layer, enemy.position, strength, range);
    }
  }

  return layer;
}

function buildTargetLayer(
  cells: GridPosition[],
  enemies: CombatProfile[],
  viewer: CombatProfile,
  difficulty: DifficultyMode
): InfluenceLayer {
  const layer = createEmptyLayer('target', cells, 0.8);

  for (const enemy of enemies) {
    if (isHostile(viewer, enemy)) {
      // Target-Value basiert auf mehreren Faktoren
      const hpPercent = enemy.currentHp / enemy.maxHp;
      const killSecureBonus = hpPercent < 0.3 ? 0.5 : 0;
      const threatBonus = estimateDamagePotential(enemy.actions) / 30 * 0.3;

      // Difficulty beeinflusst Target-Auswahl
      const difficultyMod = getDifficultyTargetModifier(enemy, difficulty);

      const strength = Math.min(1.0, 0.5 + killSecureBonus + threatBonus + difficultyMod);
      propagateInfluence(layer, enemy.position, strength, 10);
    }
  }

  return layer;
}
```

### 2.3 Propagation-Algorithmus

```typescript
function propagateInfluence(
  layer: InfluenceLayer,
  source: GridPosition,
  strength: number,
  maxRange: number
): void {
  for (const cell of getCellsInRange(source, maxRange)) {
    const distance = getDistance(source, cell);
    if (distance > maxRange) continue;

    // Exponential Decay: value = strength × (decayRate ^ distance)
    const decayedValue = strength * Math.pow(layer.decayRate, distance);

    // Additive Stacking
    const key = positionToKey(cell);
    const current = layer.grid.get(key) ?? 0;
    layer.grid.set(key, Math.min(1.0, current + decayedValue));
  }
}
```

---

## 3. Behavior Profiles

### 3.1 Die 5 Profile (basierend auf XCOM's 17 Types)

| Profile | Beschreibung | D&D Beispiele |
|---------|--------------|---------------|
| **TACTICAL** | Balanced, nutzt Cover + Flanking | Hobgoblin, Bandit Captain |
| **BERSERKER** | Maximiert Damage, ignoriert Cover | Barbarian, Berserker |
| **COWARD** | Maximiert Sicherheit, flieht bei Gefahr | Goblin, Kobold |
| **SUPPORT** | Bleibt bei Allies, nutzt Buff-Abilities | Priest, Druid |
| **ELITE** | Spezial-Logik (Multi-Target, Bodyguard) | Dragon, Lich |

### 3.2 Profile als Layer-Gewichtungen

```typescript
interface BehaviorProfile {
  name: string;
  weights: {
    threat: number;   // Negativ = meiden, Positiv = ignorieren
    target: number;   // Ziel-Priorisierung
    cover: number;    // Deckungs-Präferenz
    flank: number;    // Flanking-Präferenz
    support: number;  // Ally-Nähe
  };
  targetSelection: 'NEAREST' | 'WEAKEST' | 'HIGHEST_THREAT' | 'HIGHEST_VALUE';
  customLogic?: (pos: GridPosition, state: CombatState) => number;
}

const BEHAVIOR_PROFILES: Record<string, BehaviorProfile> = {
  tactical: {
    name: 'Tactical',
    weights: {
      threat: -0.4,   // Meidet Gefahr moderat
      target: 0.4,    // Sucht Ziele
      cover: 0.5,     // Nutzt Cover stark
      flank: 0.3,     // Flanking wenn möglich
      support: 0.2,   // Bleibt lose bei Allies
    },
    targetSelection: 'HIGHEST_VALUE',
  },

  berserker: {
    name: 'Berserker',
    weights: {
      threat: 0.2,    // Ignoriert/sucht Gefahr
      target: 0.8,    // Maximiert Target-Nähe
      cover: -0.2,    // Ignoriert Cover
      flank: 0.0,     // Flanking egal
      support: 0.0,   // Allies egal
    },
    targetSelection: 'NEAREST',
  },

  coward: {
    name: 'Coward',
    weights: {
      threat: -0.8,   // Meidet Gefahr stark
      target: 0.2,    // Nur opportunistische Angriffe
      cover: 0.6,     // Sucht Cover
      flank: 0.0,     // Kein Flanking-Risiko
      support: 0.4,   // Bleibt bei Gruppe
    },
    targetSelection: 'WEAKEST',  // Greift nur sichere Ziele an
    customLogic: (pos, state) => {
      // Flucht-Bonus wenn HP niedrig
      const hpPercent = state.currentProfile.currentHp / state.currentProfile.maxHp;
      if (hpPercent < 0.3) {
        return getDistanceToNearestExit(pos, state) * -0.5;  // Weg vom Kampf
      }
      return 0;
    },
  },

  support: {
    name: 'Support',
    weights: {
      threat: -0.5,   // Meidet Gefahr
      target: 0.1,    // Wenig offensiv
      cover: 0.4,     // Nutzt Cover
      flank: 0.0,     // Kein Flanking
      support: 0.8,   // Bleibt bei Allies (XCOM Ethereal-Style)
    },
    targetSelection: 'HIGHEST_THREAT',  // Entfernt gefährlichste Ziele
    customLogic: (pos, state) => {
      // Bonus für Positionen mit mehreren Allies in Heal-Range
      const alliesInRange = countAlliesInRange(pos, state, 30);
      return alliesInRange * 0.2;
    },
  },

  elite: {
    name: 'Elite',
    weights: {
      threat: 0.0,    // Ignoriert Gefahr
      target: 0.5,    // Sucht Ziele
      cover: 0.0,     // Ignoriert Cover
      flank: 0.0,     // Flanking egal
      support: 0.0,   // Solo-Fighter
    },
    targetSelection: 'HIGHEST_VALUE',
    customLogic: (pos, state) => {
      // XCOM Sectopod-Style: Maximiere Targets in Range
      const profile = state.currentProfile;
      const multiAttackRange = getMaxAttackRange(profile);
      const enemiesInRange = countEnemiesInRange(pos, state, multiAttackRange);
      return enemiesInRange * 0.3;  // Stark gewichtet
    },
  },
};
```

### 3.3 Profile aus Schema ableiten

```typescript
function getProfileForCreature(creature: CreatureDefinition): BehaviorProfile {
  // Priorität 1: Explizit definiertes Profile
  if (creature.behaviorProfile) {
    return BEHAVIOR_PROFILES[creature.behaviorProfile];
  }

  // Priorität 2: Aus Disposition ableiten
  const disposition = creature.baseDisposition;
  if (disposition === 'cowardly') return BEHAVIOR_PROFILES.coward;
  if (disposition === 'aggressive') return BEHAVIOR_PROFILES.berserker;
  if (disposition === 'protective') return BEHAVIOR_PROFILES.support;

  // Priorität 3: Aus Abilities ableiten
  const hasHealingAbilities = creature.actions.some(a => a.type === 'heal');
  if (hasHealingAbilities) return BEHAVIOR_PROFILES.support;

  const hasMeleeOnly = creature.actions.every(a => a.range?.normal <= 5);
  if (hasMeleeOnly && creature.challengeRating >= 5) return BEHAVIOR_PROFILES.berserker;

  // Default: Tactical
  return BEHAVIOR_PROFILES.tactical;
}
```

---

## 4. Difficulty Stufen

### 4.1 Die 4 Difficulty Modes

| Mode | Beschreibung | AI-Verhalten |
|------|--------------|--------------|
| **merciless** | Taktisch optimal | Fokussiert schwächste Ziele, nutzt alle Vorteile |
| **challenging** | Fair aber kompetent | Balanced Target-Selection, nutzt Cover |
| **dramatic** | Spannend/Cinematic | Verteilt Damage, ermöglicht Comebacks |
| **roleplay** | Charaktergetreu | Personality-Fokus, macht "Fehler" |

### 4.2 Difficulty als Modifier-System

```typescript
interface DifficultyModifiers {
  // Target Selection
  targetWeakestBonus: number;      // Bonus für schwächste Ziele
  targetDistributionPenalty: number; // Penalty für wiederholte Ziele

  // Tactical Decisions
  coverUsageBonus: number;         // Bonus für Cover-Nutzung
  flankingBonus: number;           // Bonus für Flanking

  // "Mistakes"
  suboptimalChance: number;        // Chance auf nicht-optimale Entscheidung
  focusFirePenalty: number;        // Penalty für Focus Fire
}

const DIFFICULTY_MODIFIERS: Record<DifficultyMode, DifficultyModifiers> = {
  merciless: {
    targetWeakestBonus: 0.5,       // +50% für schwächste Ziele
    targetDistributionPenalty: 0,  // Kein Penalty für Focus Fire
    coverUsageBonus: 0.3,
    flankingBonus: 0.4,
    suboptimalChance: 0,           // Immer optimal
    focusFirePenalty: 0,
  },

  challenging: {
    targetWeakestBonus: 0.2,       // Moderater Bonus
    targetDistributionPenalty: 0.1,
    coverUsageBonus: 0.2,
    flankingBonus: 0.2,
    suboptimalChance: 0.1,         // 10% suboptimal
    focusFirePenalty: 0.1,
  },

  dramatic: {
    targetWeakestBonus: 0,         // Kein Kill-Secure Fokus
    targetDistributionPenalty: 0.3, // Verteilt Damage
    coverUsageBonus: 0.1,
    flankingBonus: 0.1,
    suboptimalChance: 0.2,         // 20% "dramatische" Entscheidungen
    focusFirePenalty: 0.3,         // Starker Penalty für Focus Fire
  },

  roleplay: {
    targetWeakestBonus: 0,         // Personality-driven
    targetDistributionPenalty: 0,
    coverUsageBonus: 0,            // Nur wenn Personality es will
    flankingBonus: 0,
    suboptimalChance: 0.3,         // 30% "in-character" Fehler
    focusFirePenalty: 0,
  },
};
```

### 4.3 Difficulty in Score-Berechnung integrieren

```typescript
function calculateActionScore(
  action: Action,
  target: CombatProfile,
  state: CombatState,
  difficulty: DifficultyMode,
  profile: BehaviorProfile
): number {
  const mods = DIFFICULTY_MODIFIERS[difficulty];

  // Basis-Score: Expected Damage
  const hitChance = calculateHitChance(action, target, state);
  const expectedDamage = hitChance * getAverageDamage(action.damage);

  // Target-Value
  let targetValue = 1.0;

  // Kill-Secure Bonus (difficulty-abhängig)
  const hpPercent = target.currentHp / target.maxHp;
  if (hpPercent < 0.3) {
    targetValue += mods.targetWeakestBonus;
  }

  // Focus Fire Penalty (difficulty-abhängig)
  const timesTargeted = state.targetHistory.get(target.id) ?? 0;
  targetValue -= timesTargeted * mods.focusFirePenalty;

  // Damage Distribution Penalty (für "dramatic")
  if (timesTargeted > 0) {
    targetValue -= mods.targetDistributionPenalty;
  }

  // Threat-Bonus (Profile-abhängig)
  const threatBonus = estimateDamagePotential(target.actions) / 30;
  if (profile.targetSelection === 'HIGHEST_THREAT') {
    targetValue += threatBonus * 0.3;
  }

  // Finale Score
  let score = expectedDamage * targetValue;

  // Suboptimal Chance (roleplay/dramatic)
  if (mods.suboptimalChance > 0 && Math.random() < mods.suboptimalChance) {
    score *= 0.5 + Math.random() * 0.5;  // 50-100% des optimalen Scores
  }

  return score;
}
```

---

## 5. Turn-Ausführung

### 5.1 Hauptalgorithmus

```typescript
async function executeTurn(
  profile: CombatProfile,
  state: CombatState,
  difficulty: DifficultyMode
): Promise<TurnResult> {
  // 1. Behavior Profile ermitteln
  const behavior = getProfileForCreature(profile.creature);

  // 2. Influence Maps bauen
  const layers = buildAllLayers(state, profile);

  // 3. STUFE 1: Beste Position finden
  const bestPosition = findBestPosition(
    profile,
    layers,
    behavior,
    difficulty
  );

  // 4. Movement planen (falls nötig)
  const movement = planMovement(profile.position, bestPosition, state);

  // 5. STUFE 2: Beste Aktion finden
  const bestAction = findBestAction(
    profile,
    bestPosition,  // Aktionen von neuer Position aus evaluieren
    state,
    behavior,
    difficulty
  );

  return {
    movement,
    action: bestAction,
    explanation: generateExplanation(layers, behavior, bestPosition, bestAction),
  };
}

function findBestPosition(
  profile: CombatProfile,
  layers: InfluenceLayers,
  behavior: BehaviorProfile,
  difficulty: DifficultyMode
): GridPosition {
  const reachableCells = getReachableCells(profile.position, profile.speed);
  const mods = DIFFICULTY_MODIFIERS[difficulty];

  let bestCell = profile.position;
  let bestScore = -Infinity;

  for (const cell of reachableCells) {
    // Layer-Werte abrufen
    const threat = layers.threat.grid.get(positionToKey(cell)) ?? 0;
    const target = layers.target.grid.get(positionToKey(cell)) ?? 0;
    const cover = layers.cover.grid.get(positionToKey(cell)) ?? 0;
    const flank = layers.flank.grid.get(positionToKey(cell)) ?? 0;
    const support = layers.support.grid.get(positionToKey(cell)) ?? 0;

    // Score berechnen
    let score =
      threat * behavior.weights.threat +
      target * behavior.weights.target +
      cover * (behavior.weights.cover + mods.coverUsageBonus) +
      flank * (behavior.weights.flank + mods.flankingBonus) +
      support * behavior.weights.support;

    // Custom Logic
    if (behavior.customLogic) {
      score += behavior.customLogic(cell, { currentProfile: profile, ...state });
    }

    if (score > bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }

  return bestCell;
}

function findBestAction(
  profile: CombatProfile,
  fromPosition: GridPosition,
  state: CombatState,
  behavior: BehaviorProfile,
  difficulty: DifficultyMode
): ActionResult | null {
  const enemies = getHostileProfiles(profile, state);
  const availableActions = getAvailableActions(profile, fromPosition, state);

  let bestAction: ActionResult | null = null;
  let bestScore = -Infinity;

  for (const action of availableActions) {
    for (const target of enemies) {
      if (!canTarget(action, fromPosition, target.position)) continue;

      const score = calculateActionScore(action, target, state, difficulty, behavior);

      if (score > bestScore) {
        bestScore = score;
        bestAction = { action, target, expectedScore: score };
      }
    }
  }

  return bestAction;
}
```

### 5.2 Erklärbarkeit (GM-in-the-Loop)

```typescript
interface TurnExplanation {
  position: {
    chosen: GridPosition;
    reason: string;
    layerValues: {
      threat: number;
      target: number;
      cover: number;
      flank: number;
      support: number;
    };
  };
  action: {
    chosen: Action;
    target: CombatProfile;
    reason: string;
    score: number;
    alternatives: { action: Action; target: CombatProfile; score: number }[];
  };
}

function generateExplanation(
  layers: InfluenceLayers,
  behavior: BehaviorProfile,
  position: GridPosition,
  action: ActionResult
): TurnExplanation {
  const posKey = positionToKey(position);

  // Dominanter Layer ermitteln
  const layerValues = {
    threat: layers.threat.grid.get(posKey) ?? 0,
    target: layers.target.grid.get(posKey) ?? 0,
    cover: layers.cover.grid.get(posKey) ?? 0,
    flank: layers.flank.grid.get(posKey) ?? 0,
    support: layers.support.grid.get(posKey) ?? 0,
  };

  const contributions = [
    { name: 'threat', value: layerValues.threat * behavior.weights.threat },
    { name: 'target', value: layerValues.target * behavior.weights.target },
    { name: 'cover', value: layerValues.cover * behavior.weights.cover },
    { name: 'flank', value: layerValues.flank * behavior.weights.flank },
    { name: 'support', value: layerValues.support * behavior.weights.support },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const dominant = contributions[0];
  const positionReason = generatePositionReason(dominant, behavior);

  return {
    position: {
      chosen: position,
      reason: positionReason,
      layerValues,
    },
    action: {
      chosen: action.action,
      target: action.target,
      reason: generateActionReason(action, behavior),
      score: action.expectedScore,
      alternatives: [], // Top 3 alternatives
    },
  };
}

function generatePositionReason(dominant: { name: string; value: number }, behavior: BehaviorProfile): string {
  const reasons: Record<string, string> = {
    threat: dominant.value < 0 ? 'Meidet Gefahr' : 'Ignoriert Gefahr',
    target: 'Nähert sich Zielen',
    cover: 'Sucht Deckung',
    flank: 'Positioniert für Flanking',
    support: 'Bleibt bei Verbündeten',
  };
  return `${behavior.name}: ${reasons[dominant.name]}`;
}
```

---

## 6. Implementierungs-Phasen

### Phase 1: Kern-System (~500 LOC)

**Dateien:**
- `src/services/combatantAI/influenceMaps.ts` (NEU)
- `src/services/combatantAI/behaviorProfiles.ts` (NEU)
- `src/services/combatantAI/combatDirector.ts` (NEU)

**Inhalt:**
- 5 Influence Layer (THREAT, TARGET, COVER, FLANK, SUPPORT)
- Propagation-Algorithmus
- Position-Scoring mit Layer-Kombination
- 3 Behavior Profiles (TACTICAL, BERSERKER, COWARD)

**Tests:**
- Goblin (Coward) meidet Gefahr
- Bandit (Tactical) nutzt Cover + Flanking
- Berserker ignoriert Cover, sucht nächstes Ziel

### Phase 2: Difficulty + Action Selection (~300 LOC)

**Dateien:**
- `src/services/combatantAI/difficultyModifiers.ts` (NEU)
- `src/services/combatantAI/actionScoring.ts` (ERWEITERN)

**Inhalt:**
- 4 Difficulty Modes
- Action-Scoring mit Difficulty-Modifiern
- Kill-Secure vs. Damage Distribution
- Suboptimal-Chance für roleplay/dramatic

### Phase 3: Erweiterungen (~400 LOC)

**Inhalt:**
- SUPPORT + ELITE Profile
- Custom Logic für spezielle Creatures
- Ability-spezifische Gewichtungen (wie XCOM Blood Call)
- Heatmap-Visualisierung für Debugging

---

## 7. Quellen

- [GDC 2013: AI Postmortems (XCOM)](https://www.gdcvault.com/play/1018058/AI-Postmortems-Assassin-s-Creed)
- [PC Gamer: The AI tricks behind XCOM](https://www.pcgamer.com/gdc-2013-the-ai-tricks-behind-xcom-assassins-creed-3-and-warframe/)
- [Game AI Pro 2: Modular Tactical Influence Maps](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf)
- [Utility AI Introduction](https://shaggydev.com/2023/04/19/utility-ai/)
