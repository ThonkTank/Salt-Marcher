> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# findTargets

> **Verantwortlichkeit:** Ziel-Auswahl fuer Combat-Aktionen
> **Input:** Action, Actor, State
> **Output:** TargetResult { targets[], isAoE, friendlyFire }
> **Pfad:** `src/services/combatTracking/resolution/findTargets.ts`

## Uebersicht

`findTargets` ist der erste Schritt der Resolution-Pipeline. Er bestimmt, welche Combatants von einer Aktion betroffen sind.

**Single Source of Truth:** Diese Datei ist die kanonische Quelle fuer alle Target-Filtering-Logik im Combat-System.

---

## Architektur-Hierarchie

```
combatHelpers.ts (Primitives)
├── isHostile(groupA, groupB, alliances)
└── isAllied(groupA, groupB, alliances)
        │
        ▼
findTargets.ts (Single Source of Truth)
├── matchesValidTargets() - verwendet isHostile/isAllied
├── getValidCandidates() - exportiert fuer AI
├── isValidTarget() - exportiert fuer Validation
└── findTargets() - Haupt-Entry-Point
        │
        ▼
Consumers (delegieren)
├── actionSelection.getCandidates() → getValidCandidates()
└── zoneEffects.isValidZoneTarget() → isHostile/isAllied
```

**Warum Single Source of Truth?**
- Konsistente Logik fuer Alliance-Pruefung
- Keine duplizierten Switch-Statements
- Aenderungen an Targeting-Regeln an einer Stelle

```
Action.targeting + Actor-Position + State
                    │
                    ▼
            ┌───────────────┐
            │  findTargets  │
            └───────────────┘
                    │
                    ▼
        TargetResult { targets[], isAoE }
```

---

## Targeting-Typen

### Single Target

Die meisten Aktionen treffen ein einzelnes Ziel.

```typescript
targeting: {
  type: 'single',
  validTargets: 'enemies'
}
```

**Logik:**
1. Target bereits im ResolutionContext bekannt (von AI/Spieler gewaehlt)
2. Validiere Range: `distance(actor, target) <= action.range.normal`
3. Validiere Alliance: `isValidTarget(actor, target, validTargets)`

### Multiple Targets

Buff-Spells die mehrere Verbuendete treffen.

```typescript
targeting: {
  type: 'multiple',
  count: 3,
  validTargets: 'allies'
}
```

**Logik:**
1. Targets bereits im ResolutionContext (von AI/Spieler gewaehlt)
2. Validiere: `targets.length <= count`
3. Validiere Range fuer jeden Target
4. Validiere Alliance fuer jeden Target

### Area of Effect (AoE)

Aktionen die eine Flaeche treffen.

```typescript
targeting: {
  type: 'area',
  validTargets: 'enemies',
  aoe: {
    shape: 'sphere',
    size: 20,           // Radius in Fuß
    origin: 'point'     // 'self' | 'point' | 'creature'
  }
}
```

**Logik:**
1. Bestimme AoE-Ursprung (Origin)
2. Finde alle Combatants im Radius
3. Filtere nach `validTargets`
4. Optional: Pruefe `friendlyFire`

---

## ValidTargets-Filter

| Wert | Beschreibung | Pruefung |
|------|--------------|----------|
| `'enemies'` | Nur feindliche Ziele | `isHostile(actor, target)` |
| `'allies'` | Nur verbuendete Ziele (ohne self) | `!isHostile(actor, target) && actor.id !== target.id` |
| `'self'` | Nur der Actor selbst | `actor.id === target.id` |
| `'any'` | Alle Combatants | Kein Filter |

```typescript
function isValidTarget(
  actor: Combatant,
  target: Combatant,
  validTargets: ValidTargets
): boolean {
  switch (validTargets) {
    case 'enemies':
      return isHostile(actor, target);
    case 'allies':
      return !isHostile(actor, target) && actor.id !== target.id;
    case 'self':
      return actor.id === target.id;
    case 'any':
      return true;
  }
}
```

---

## Range-Validierung

### Reach (Melee)

```typescript
range: { type: 'reach', normal: 5 }
```

- Distanz in Fuß (Grid-Cells * 5)
- Diagonal-Bewegung: 5-10-5 Regel oder einfach 5ft

### Ranged

```typescript
range: { type: 'ranged', normal: 80, long: 320 }
```

- `normal`: Volle Trefferchance
- `long`: Disadvantage auf Attack (nicht hier behandelt, in determineSuccess)

### Self

```typescript
range: { type: 'self' }
```

- Nur Actor selbst, keine Range-Pruefung

### Touch

```typescript
range: { type: 'touch' }
```

- Behandelt wie Reach mit 5ft

---

## AoE-Shapes

### Sphere (Kugel)

```typescript
aoe: { shape: 'sphere', size: 20, origin: 'point' }
```

- `size` = Radius in Fuß
- Alle Zellen mit Distanz <= size/5 zum Ursprung

### Cube (Wuerfel)

```typescript
aoe: { shape: 'cube', size: 15, origin: 'point' }
```

- `size` = Kantenlaenge in Fuß
- Ursprung ist eine Ecke des Wuerfels

### Cone (Kegel)

```typescript
aoe: { shape: 'cone', size: 30, origin: 'self' }
```

- `size` = Laenge in Fuß
- Breite am Ende = Laenge
- Richtung vom Actor zum Ziel-Punkt

### Line (Linie)

```typescript
aoe: { shape: 'line', size: 60, width: 5, origin: 'self' }
```

- `size` = Laenge in Fuß
- `width` = Breite in Fuß (default: 5)

### Cylinder (Zylinder)

```typescript
aoe: { shape: 'cylinder', size: 20, height: 40, origin: 'point' }
```

- `size` = Radius in Fuß
- `height` = Hoehe in Fuß (fuer 3D, aktuell ignoriert)

---

## Zone-Radius-Checks

Fuer Zone-Effekte (Spirit Guardians, Auras) wird der Radius relativ zum Zone-Owner geprueft.

```typescript
function isInZoneRadius(
  zone: ActiveZone,
  combatant: Combatant,
  state: CombatState
): boolean {
  const owner = state.combatants.find(c => c.id === zone.ownerId);
  if (!owner) return false;

  const ownerPos = getPosition(owner);
  const targetPos = getPosition(combatant);
  const distance = gridDistance(ownerPos, targetPos) * state.grid.cellSizeFeet;

  return distance <= zone.effect.zone.radius;
}
```

---

## Friendly Fire

Bei AoE-Aktionen kann `friendlyFire` aktiviert sein:

```typescript
targeting: {
  type: 'area',
  validTargets: 'enemies',
  friendlyFire: true,       // Auch Allies im AoE betroffen
  aoe: { shape: 'sphere', size: 20 }
}
```

**Logik:**
- `friendlyFire: false` → Nur `validTargets` betroffen
- `friendlyFire: true` → Alle Combatants im AoE betroffen

---

## Output

```typescript
interface TargetResult {
  targets: Combatant[];     // Alle betroffenen Ziele
  isAoE: boolean;           // Flaechen-Effekt?
  friendlyFire: boolean;    // Wurden Allies getroffen?
}
```

---

## Beispiele

### Longsword (Single Melee)

```typescript
// Input
action.targeting = { type: 'single', validTargets: 'enemies' }
action.range = { type: 'reach', normal: 5 }
context.target = Goblin

// findTargets
const distance = gridDistance(actorPos, targetPos) * 5; // 5ft
const inRange = distance <= 5; // true
const validTarget = isHostile(actor, Goblin); // true

// Output
{ targets: [Goblin], isAoE: false, friendlyFire: false }
```

### Fireball (AoE)

```typescript
// Input
action.targeting = {
  type: 'area',
  validTargets: 'enemies',
  friendlyFire: true,
  aoe: { shape: 'sphere', size: 20, origin: 'point' }
}
context.position = { x: 5, y: 5 }

// findTargets
const cellsInRadius = getCellsInRadius({ x: 5, y: 5 }, 4); // 20ft = 4 cells
const combatantsInArea = state.combatants.filter(c =>
  cellsInRadius.some(cell => samePosition(getPosition(c), cell))
);
// Goblin A, Goblin B, Ally C all in area

// Output (friendlyFire = true, also Allies)
{ targets: [GoblinA, GoblinB, AllyC], isAoE: true, friendlyFire: true }
```

### Spirit Guardians Zone

```typescript
// Input: Zone on-enter Trigger
zone.effect.zone = { radius: 15, targetFilter: 'enemies' }
zone.ownerId = Cleric.id
movingCombatant = Goblin

// findTargets
const distance = gridDistance(clericPos, goblinPos) * 5; // 10ft
const inRadius = distance <= 15; // true
const validTarget = isHostile(Cleric, Goblin); // true

// Output
{ targets: [Goblin], isAoE: false, friendlyFire: false }
```

---

## Verwandte Dokumente

- [actionResolution.md](actionResolution.md) - Pipeline-Uebersicht
- [getModifiers.md](getModifiers.md) - Naechster Pipeline-Schritt (Modifier sammeln)
- [determineSuccess.md](determineSuccess.md) - Pipeline-Schritt 3
- [CombatEvent.targeting](../../types/combatEvent.md#targeting) - Targeting-Schema
