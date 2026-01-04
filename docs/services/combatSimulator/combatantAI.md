# combatantAI

> **Verantwortlichkeit:** AI-Entscheidungslogik fuer Combat - was soll eine Kreatur tun?
> **Konsumiert von:** [combatResolver](combatResolver.md), [Encounter-Runner](../../orchestration/EncounterWorkflow.md) (zukuenftig)
>
> **Verwandte Dokumente:**
> - [combatResolver.md](combatResolver.md) - State-Management + Execution
> - [difficulty.md](../encounter/difficulty.md) - Orchestrator fuer Difficulty-Simulation

Standalone-callable Entscheidungslogik fuer Combat-AI. Ermoeglicht sowohl PMF-basierte Simulation (fuer Difficulty) als auch zukuenftigen Encounter-Runner (fuer GM-Unterstuetzung).

---

## Exports

### Action Selection

| Funktion | Beschreibung |
|----------|--------------|
| `selectBestActionAndTarget(attacker, state)` | Waehlt beste (Action, Target)-Kombination basierend auf EV-Score |
| `calculatePairScore(attacker, action, target, distance)` | Berechnet Score fuer eine (Action, Target)-Kombination |
| `getActionIntent(action)` | Erkennt Intent: `damage`, `healing`, oder `control` |
| `getCandidates(attacker, state, intent)` | Filtert moegliche Ziele basierend auf Intent und Allianzen |

### Alliance Helpers

| Funktion | Beschreibung |
|----------|--------------|
| `isAllied(groupA, groupB, alliances)` | Prueft ob zwei Gruppen verbuendet sind |
| `isHostile(groupA, groupB, alliances)` | Prueft ob zwei Gruppen Feinde sind (nicht verbuendet) |

### Movement (Vektor-System)

| Funktion | Beschreibung |
|----------|--------------|
| `calculateMovementVector(profile, state)` | Berechnet optimalen Bewegungs-Vektor (Attraction/Repulsion) |
| `calculateAttraction(profile, other, distance, isEnemy)` | Attraction-Faktor fuer einen Combatant |
| `calculateRepulsion(profile, other, distance, isEnemy)` | Repulsion-Faktor fuer einen Combatant |
| `calculateMoveEV(from, to, profile, state)` | EV einer Bewegung (Vektor-Alignment) |
| `calculateDashEV(profile, state)` | EV fuer Dash (Position-Verbesserung vs Attack) |
| `calculateSweetSpot(actions)` | Berechnet optimale Kampfdistanz |
| `determineCombatPreference(actions)` | Bestimmt Praeferenz: `melee`, `ranged`, oder `hybrid` |

### Potential Estimation

| Funktion | Beschreibung |
|----------|--------------|
| `estimateDamagePotential(actions)` | Schaetzt maximales Damage-Potential (Wuerfel-EV) |
| `estimateHealPotential(actions)` | Schaetzt maximales Heal-Potential |
| `estimateControlPotential(actions)` | Schaetzt Control-Potential (basierend auf Save DC) |
| `estimateCombatantValue(profile)` | Gesamtwert eines Combatants fuer Team |

### Utilities

| Funktion | Beschreibung |
|----------|--------------|
| `calculateHitChance(attackBonus, targetAC)` | Berechnet Hit-Chance (5%-95% Range) |
| `getDistance(a, b)` | Berechnet Distanz zwischen zwei Positionen |

---

## Types

### CombatProfile

Minimal-Profil fuer einen Kampfteilnehmer:

```typescript
interface CombatProfile {
  participantId: string;
  groupId: string;         // 'party' fuer PCs, UUID fuer Encounter-Gruppen
  hp: ProbabilityDistribution;
  deathProbability: number;
  ac: number;
  speed: SpeedBlock;
  actions: Action[];
  conditions?: ConditionState[];
  position: Vector3;
  environmentBonus?: number;
}
```

### SimulationState

Minimal-State fuer AI-Entscheidungen:

```typescript
interface SimulationState {
  profiles: CombatProfile[];
  alliances: Record<string, string[]>;  // groupId → verbuendete groupIds
}
```

### ActionTargetScore

Ergebnis einer (Action, Target)-Bewertung:

```typescript
interface ActionTargetScore {
  action: Action;
  target: CombatProfile;
  score: number;
  intent: ActionIntent;
}

type ActionIntent = 'damage' | 'healing' | 'control';
```

### CombatPreference

```typescript
type CombatPreference = 'melee' | 'ranged' | 'hybrid';
```

---

## Standalone-Nutzung (Encounter-Runner)

Die AI-Funktionen sind standalone callable fuer den zukuenftigen Encounter-Runner:

```typescript
import {
  selectBestActionAndTarget,
  calculateMovementVector,
  calculateMoveEV,
  getCandidates,
} from '@/services/combatSimulator/combatantAI';

// "Was soll dieser Goblin tun?"
const suggestion = selectBestActionAndTarget(goblinProfile, state);
// → { action: 'Shortbow', target: wizard, score: 0.8, intent: 'damage' }

// "In welche Richtung soll dieser Goblin sich bewegen?"
const optimalVector = calculateMovementVector(goblinProfile, state);
// → { x: 1.2, y: -0.5, z: 0 } // Richtung zum optimalen Ziel

// "Ist diese Bewegung gut?"
const moveEV = calculateMoveEV(goblinProfile.position, targetCell, goblinProfile, state);
// → 0.8 (hoher EV = gute Bewegung)
```

---

## Action-Selection Algorithmus

### EV-gewichtete Auswahl

Die beste Action wird basierend auf Expected Value (EV) gewaehlt:

```
Score = f(Intent, Action, Target, Distance)

Damage:  Score = (hitChance x expectedDamage) / targetHP
Healing: Score = allyValue x urgency x healEfficiency
Control: Score = targetValue (je wertvoller, desto besser zu disablen)
```

### Kandidaten-Filterung

| Intent | Kandidaten |
|--------|------------|
| `damage` | Feinde (nicht verbuendet), alive |
| `healing` | Verbuendete (ausser sich selbst), alive |
| `control` | Feinde (nicht verbuendet), alive |

---

## Movement-Algorithmus

### Vektor-basiertes Movement

Jeder Combatant uebt auf jeden anderen eine Kraft aus:
- **Attraction**: Ich will naeher (Feinde angreifen, Sweet-Spot erreichen)
- **Repulsion**: Ich will weg (zu nah fuer Ranged)

Die Summe aller Vektoren ergibt die optimale Bewegungsrichtung:

```typescript
optimalVector = Σ(directionToOther × (attraction - repulsion))
```

### Attraction-Faktoren

| Bedingung | Attraction |
|-----------|:----------:|
| Feind nicht im Sweet-Spot | +0.5 |
| Melee-Praeferenz, Distanz > 2 Cells | +0.8 |

### Repulsion-Faktoren

| Bedingung | Repulsion |
|-----------|:---------:|
| Ranged-Praeferenz, Distanz < 3 Cells | +0.6 |

### MoveEV-Berechnung

```typescript
alignment = dotProduct(normalizedOptimal, normalizedMove);
baseEV = alignment × min(optimalMagnitude, 1.0);
moveEV = baseEV + attackBonus;  // +0.5 wenn Ziel Attack ermoeglicht
```

### Sweet-Spot

Die optimale Kampfdistanz basiert auf den Action-Reichweiten:

```typescript
sweetSpot = Σ(range x damagePotential) / Σ(damagePotential)
```

| Kreatur | Actions | Sweet-Spot |
|---------|---------|:----------:|
| Wolf | Bite (5ft) | 5ft |
| Goblin | Scimitar (5ft), Shortbow (80ft) | ~40ft |
| Mage | Fire Bolt (120ft), Fireball (150ft) | ~60ft |

### Combat-Praeferenz

| Ranged-Ratio | Praeferenz | Verhalten |
|:------------:|:----------:|:----------|
| >= 70% | `ranged` | Repulsion wenn zu nah |
| 30-70% | `hybrid` | Balanciert |
| <= 30% | `melee` | Starke Attraction |

---

## TODO

### TODO: Ally-Support-Attraction

`calculateAttraction()` enthaelt Stub fuer Ally-Support. Wenn `profile.actions` healing enthaelt, sollte Attraction zu verletzten Allies steigen.

### TODO: Enemy-DPR-basierte Repulsion

`calculateRepulsion()` enthaelt auskommentierten Code. Hoher Enemy-DPR sollte Repulsion erhoehen (Threshold kalibrieren).
