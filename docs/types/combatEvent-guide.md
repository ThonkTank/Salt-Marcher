> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# CombatEvent Guide: Neue Actions erstellen

> **Ziel:** Praktische Anleitung zum Erstellen neuer CombatEvents
> **Voraussetzung:** Grundkenntnisse D&D 5e
> **Referenz:** [combatEvent.md](combatEvent.md) (vollstaendige Spezifikation)

---

## Uebersicht

### Was ist ein CombatEvent?

CombatEvent ist das einheitliche Schema fuer **alle** Combat-relevanten Faehigkeiten:

- **Aktionen:** Angriffe, Zauber, Spezialfaehigkeiten
- **Reaktionen:** Opportunity Attacks, Shield, Counterspell
- **Traits:** Pack Tactics, Magic Resistance
- **Auras:** Paladin Aura of Protection
- **Zones:** Spirit Guardians, Cloudkill

### Die 7 Komponenten

Jedes CombatEvent besteht aus **genau 7 Komponenten**:

| Komponente | Frage | Beispiel |
|------------|-------|----------|
| **precondition** | Was muss wahr sein? | `{ type: 'always' }` |
| **trigger** | Wie wird es ausgeloest? | `{ type: 'active' }` |
| **cost** | Was kostet es? | `{ type: 'action-economy', economy: 'action' }` |
| **targeting** | Wer/Was/Wo? | `{ type: 'single', range: {...}, filter: 'enemy' }` |
| **check** | Wie wird Erfolg bestimmt? | `{ type: 'attack', attackType: 'melee-weapon', bonus: 4 }` |
| **effect** | Was passiert? | `{ type: 'damage', damage: '1d6+2', damageType: 'slashing' }` |
| **duration** | Wie lange? | `{ type: 'instant' }` |

### Wo werden CombatEvents definiert?

| Datei | Inhalt |
|-------|--------|
| `presets/actions/index.ts` | Alle Action-Presets |
| `presets/modifiers/index.ts` | Condition-Modifiers |

---

## Quick-Start Templates

### 1. Einfacher Nahkampf-Angriff

```typescript
{
  id: 'goblin-scimitar',
  name: 'Scimitar',
  precondition: { type: 'always' },
  trigger: { type: 'active' },
  cost: { type: 'action-economy', economy: 'action' },
  targeting: {
    type: 'single',
    range: { type: 'reach', distance: 5 },
    filter: 'enemy',
  },
  check: { type: 'attack', attackType: 'melee-weapon', bonus: 4 },
  effect: { type: 'damage', damage: '1d6+2', damageType: 'slashing' },
  duration: { type: 'instant' },
}
```

**Die 7 Komponenten:**
- `precondition: { type: 'always' }` - Keine Vorbedingung
- `trigger: { type: 'active' }` - Spieler/AI waehlt aktiv
- `cost: { type: 'action-economy', economy: 'action' }` - Kostet 1 Action
- `targeting: { type: 'single', range: {...}, filter: 'enemy' }` - Ein Feind in 5ft
- `check: { type: 'attack', attackType: 'melee-weapon', bonus: 4 }` - Angriffswurf +4
- `effect: { type: 'damage', damage: '1d6+2' }` - Schaden bei Treffer
- `duration: { type: 'instant' }` - Sofortiger Effekt

---

### 2. Fernkampf-Angriff mit Munition

```typescript
{
  id: 'bandit-light-crossbow',
  name: 'Light Crossbow',
  precondition: { type: 'has-free-hands', count: 2 },  // Two-Handed
  trigger: { type: 'active' },
  cost: {
    type: 'composite',
    costs: [
      { type: 'action-economy', economy: 'action' },
      { type: 'consume-item', itemTag: 'ammunition', quantity: 1 },
    ],
  },
  targeting: {
    type: 'single',
    range: { type: 'ranged', normal: 80, disadvantage: 320 },
    filter: 'enemy',
  },
  check: { type: 'attack', attackType: 'ranged-weapon', bonus: 3 },
  effect: { type: 'damage', damage: '1d8+1', damageType: 'piercing' },
  duration: { type: 'instant' },
}
```

**Unterschied zu Nahkampf:**
- `precondition: { type: 'has-free-hands', count: 2 }` - Benoetigt 2 freie Haende
- `cost.type: 'composite'` - Mehrere Kosten kombiniert
- `cost.costs[1].type: 'consume-item'` - Verbraucht Munition aus Inventory
- `targeting.range.type: 'ranged'` - Fernkampf mit normal/disadvantage Range
- `check.attackType: 'ranged-weapon'` - Fernkampf-Angriff (automatische Modifier)

**Ranged-Modifier werden automatisch angewendet:**
- `ranged-long-range` → Disadvantage bei Distanz > normal
- `ranged-in-melee` → Disadvantage wenn Feind adjacent

---

### 3. Zauber mit Rettungswurf

```typescript
{
  id: 'spell-hold-person',
  name: 'Hold Person',
  precondition: { type: 'has-resource', resource: 'spell-slot', amount: 2 },
  trigger: { type: 'active' },
  cost: {
    type: 'composite',
    costs: [
      { type: 'action-economy', economy: 'action' },
      { type: 'spell-slot', level: 2 },
    ],
  },
  targeting: {
    type: 'single',
    range: { type: 'ranged', normal: 60 },
    filter: { type: 'creature-type', types: ['humanoid'] },
  },
  check: { type: 'save', save: 'wis', dc: { type: 'spell-dc' } },
  effect: {
    type: 'on-check-result',
    failure: {
      type: 'apply-condition',
      condition: 'paralyzed',
      to: 'target',
      source: 'self',
    },
    success: { type: 'none' },
  },
  duration: {
    type: 'concentration',
    maxDuration: { type: 'minutes', count: 1 },
    repeatSave: {
      frequency: 'end-of-turn',
      whose: 'target',
      onSuccess: 'end-effect',
    },
  },
}
```

**Wichtige Felder:**
- `precondition: { type: 'has-resource' }` - Prueft Spell Slot Verfuegbarkeit
- `cost: { type: 'composite' }` - Action + Spell Slot
- `targeting.filter: { type: 'creature-type' }` - Nur Humanoide
- `check: { type: 'save' }` - Rettungswurf statt Angriff
- `effect: { type: 'on-check-result' }` - Unterschiedliche Effekte je nach Erfolg
- `duration: { type: 'concentration' }` - Mit Repeat-Save

---

### 4. Heilzauber (Bonus Action)

```typescript
{
  id: 'spell-healing-word',
  name: 'Healing Word',
  precondition: { type: 'has-resource', resource: 'spell-slot', amount: 1 },
  trigger: { type: 'active' },
  cost: {
    type: 'composite',
    costs: [
      { type: 'action-economy', economy: 'bonus-action' },
      { type: 'spell-slot', level: 1 },
    ],
  },
  targeting: {
    type: 'single',
    range: { type: 'ranged', normal: 60 },
    filter: 'ally',
  },
  check: { type: 'auto' },  // Kein Wurf noetig
  effect: { type: 'healing', healing: '1d4+3' },
  duration: { type: 'instant' },
}
```

**Wichtige Felder:**
- `cost.economy: 'bonus-action'` - Bonus-Aktion statt Action
- `targeting.filter: 'ally'` - Zielt auf Verbuendete
- `check: { type: 'auto' }` - Automatischer Erfolg (kein Wurf)
- `effect: { type: 'healing' }` - Heilung statt Schaden

---

### 5. Passiver Trait (Pack Tactics)

```typescript
{
  id: 'trait-pack-tactics',
  name: 'Pack Tactics',
  precondition: { type: 'always' },
  trigger: { type: 'passive' },
  cost: { type: 'free' },
  targeting: { type: 'self' },
  check: { type: 'none' },
  effect: { type: 'none' },  // Effekt via schemaModifiers
  duration: { type: 'permanent' },
  schemaModifiers: [{
    id: 'pack-tactics',
    name: 'Pack Tactics',
    description: 'Advantage wenn Verbuendeter am Ziel',
    condition: {
      type: 'exists',
      entity: { type: 'quantified', quantifier: 'any', filter: 'ally', relativeTo: 'attacker' },
      where: {
        type: 'and',
        conditions: [
          { type: 'adjacent-to', subject: 'self', object: 'target' },
          { type: 'is-incapacitated', entity: 'self', negate: true },
        ],
      },
    },
    contextualEffects: {
      whenAttacking: { advantage: true },
    },
    priority: 7,
  }],
}
```

**SchemaModifier-Struktur:**
- `condition` - Precondition wann der Modifier gilt
- `contextualEffects.whenAttacking` - Effekt beim Angreifen
- `contextualEffects.whenDefending` - Effekt beim Verteidigen
- `priority` - Reihenfolge (hoeher = spaeter angewendet)

---

### 6. Zone-Effekt (Spirit Guardians)

```typescript
{
  id: 'spell-spirit-guardians',
  name: 'Spirit Guardians',
  precondition: { type: 'has-resource', resource: 'spell-slot', amount: 3 },
  trigger: { type: 'active' },
  cost: {
    type: 'composite',
    costs: [
      { type: 'action-economy', economy: 'action' },
      { type: 'spell-slot', level: 3 },
    ],
  },
  targeting: { type: 'self' },
  check: { type: 'none' },
  effect: {
    type: 'create-zone',
    zone: {
      id: 'spirit-guardians-zone',
      shape: { shape: 'sphere', radius: 15 },
      movement: { type: 'attached', to: 'self' },
      filter: 'enemies',
      speedModifier: 0.5,
      effects: [{
        triggers: ['on-enter', 'on-start-turn'],
        effect: {
          type: 'on-check-result',
          failure: { type: 'damage', damage: '3d8', damageType: 'radiant' },
          success: { type: 'damage', damage: '1d8', damageType: 'radiant' },
        },
      }],
    },
  },
  duration: {
    type: 'concentration',
    maxDuration: { type: 'minutes', count: 10 },
  },
}
```

**Zone-Schema:**
- `zone.shape` - Form: `sphere`, `cube`, `cone`, `line`, `cylinder`
- `zone.movement`:
  - `{ type: 'static' }` - Bleibt stehen
  - `{ type: 'attached', to: 'self' }` - Folgt Caster
  - `{ type: 'movable', cost: {...}, distance: 60 }` - Bewegbar
  - `{ type: 'drift', direction: 'wind', distance: 10 }` - Driftet
- `zone.effects[].triggers` - `on-enter`, `on-leave`, `on-start-turn`, `on-end-turn`
- `zone.filter` - `enemies`, `allies`, `all`, `any`

---

## Komponenten-Referenz

### precondition (Vorbedingung)

| Typ | Beispiel | Bedeutung |
|-----|----------|-----------|
| `always` | `{ type: 'always' }` | Immer verfuegbar |
| `has-resource` | `{ type: 'has-resource', resource: 'spell-slot', amount: 2 }` | Benoetigt Resource |
| `has-free-hands` | `{ type: 'has-free-hands', count: 2 }` | Benoetigt freie Haende |
| `has-condition` | `{ type: 'has-condition', entity: 'target', condition: 'prone' }` | Ziel hat Condition |
| `is-wielding` | `{ type: 'is-wielding', weaponProperty: ['finesse'] }` | Traegt Waffe mit Property |

### trigger (Ausloeser)

| Typ | Beispiel | Bedeutung |
|-----|----------|-----------|
| `active` | `{ type: 'active' }` | Spieler/AI waehlt aktiv |
| `reaction` | `{ type: 'reaction', event: 'on-enemy-leaves-reach' }` | Reaktion auf Event |
| `passive` | `{ type: 'passive' }` | Immer aktiv (Traits) |
| `aura` | `{ type: 'aura', radius: 10 }` | Aura-Effekt |

### cost (Kosten)

| Typ | Beispiel | Bedeutung |
|-----|----------|-----------|
| `action-economy` | `{ type: 'action-economy', economy: 'action' }` | Action/Bonus/Reaction |
| `spell-slot` | `{ type: 'spell-slot', level: 3 }` | Spell Slot Level 3 |
| `consume-item` | `{ type: 'consume-item', itemTag: 'ammunition', quantity: 1 }` | Item aus Inventory |
| `composite` | `{ type: 'composite', costs: [...] }` | Mehrere Kosten kombiniert |
| `free` | `{ type: 'free' }` | Keine Kosten |

### targeting (Zielauswahl)

| Typ | Beispiel | Bedeutung |
|-----|----------|-----------|
| `single` | `{ type: 'single', range: {...}, filter: 'enemy' }` | Ein Ziel |
| `multi` | `{ type: 'multi', count: 3, range: {...}, filter: 'ally' }` | Mehrere Ziele |
| `area` | `{ type: 'area', shape: {...}, origin: {...}, filter: 'any' }` | Flaecheneffekt |
| `self` | `{ type: 'self' }` | Nur Selbst |

### targeting.range (Reichweite)

| Typ | Beispiel | Bedeutung |
|-----|----------|-----------|
| `reach` | `{ type: 'reach', distance: 5 }` | Nahkampf 5ft |
| `ranged` | `{ type: 'ranged', normal: 80, disadvantage: 320 }` | Fernkampf |
| `touch` | `{ type: 'touch' }` | Beruehrung |
| `self` | `{ type: 'self' }` | Nur Selbst |

### check (Erfolgspruefung)

| Typ | Beispiel | Bedeutung |
|-----|----------|-----------|
| `attack` | `{ type: 'attack', attackType: 'melee-weapon', bonus: 4 }` | Angriffswurf |
| `save` | `{ type: 'save', save: 'dex', dc: { type: 'spell-dc' } }` | Rettungswurf |
| `contested` | `{ type: 'contested', self: 'athletics', target: {...} }` | Vergleichswurf |
| `auto` | `{ type: 'auto' }` | Automatischer Erfolg |
| `none` | `{ type: 'none' }` | Kein Check (passiv) |

### check.attackType

| Wert | Bedeutung |
|------|-----------|
| `melee-weapon` | Nahkampf-Waffenangriff |
| `ranged-weapon` | Fernkampf-Waffenangriff |
| `melee-spell` | Nahkampf-Zauberangriff |
| `ranged-spell` | Fernkampf-Zauberangriff |

### effect (Effekt)

| Typ | Beispiel | Bedeutung |
|-----|----------|-----------|
| `damage` | `{ type: 'damage', damage: '1d8+3', damageType: 'slashing' }` | Schaden |
| `healing` | `{ type: 'healing', healing: '2d8+3' }` | Heilung |
| `apply-condition` | `{ type: 'apply-condition', condition: 'prone', to: 'target' }` | Condition anwenden |
| `on-check-result` | `{ type: 'on-check-result', success: {...}, failure: {...} }` | Je nach Wurf |
| `all` | `{ type: 'all', effects: [...] }` | Mehrere Effekte |
| `none` | `{ type: 'none' }` | Kein Effekt (bei Traits mit schemaModifiers) |

### duration (Dauer)

| Typ | Beispiel | Bedeutung |
|-----|----------|-----------|
| `instant` | `{ type: 'instant' }` | Sofort vorbei |
| `rounds` | `{ type: 'rounds', count: 1, until: 'end' }` | X Runden |
| `minutes` | `{ type: 'minutes', count: 1 }` | X Minuten |
| `concentration` | `{ type: 'concentration', maxDuration: {...} }` | Konzentration |
| `permanent` | `{ type: 'permanent' }` | Bis entfernt |

---

## Schritt-fuer-Schritt: Neue Action hinzufuegen

### 1. Template waehlen

Finde in den Quick-Start Templates das passendste Beispiel fuer deinen Anwendungsfall.

### 2. In presets/actions/index.ts eintragen

Fuege die Action zum entsprechenden Array hinzu:

| Array | Verwendung |
|-------|------------|
| `standardActions` | Fuer alle Combatants verfuegbar (Dash, Dodge, etc.) |
| `actionPresets` | Kreatur-spezifische Actions |
| `genericSpells` | Wiederverwendbare Zauber |
| `passiveTraits` | Passive Faehigkeiten und Auras |

### 3. An Kreatur zuweisen

In der Kreatur-Definition (`presets/creatures/`) die Action-ID zur `actionIds`-Liste hinzufuegen:

```typescript
{
  id: 'goblin',
  name: 'Goblin',
  actionIds: ['goblin-scimitar', 'goblin-shortbow', 'trait-nimble-escape'],
  // ...
}
```

### 4. Testen

```bash
# TypeScript-Check
npm run typecheck

# Resolution Pipeline testen
npx tsx scripts/test-action.ts bandit:enemy@0,0 bandit-scimitar goblin:party@1,0

# Mit Debug-Logging
DEBUG_SERVICES=true npx tsx scripts/test-action.ts ...
```

---

## Referenz-Dateien

| Datei | Inhalt |
|-------|--------|
| `presets/actions/index.ts` | Alle Action-Presets |
| `presets/modifiers/index.ts` | Condition-Modifiers |
| `presets/creatures/` | Kreatur-Definitionen mit actionIds |
| `scripts/test-action.ts` | CLI-Tool zum Testen der Resolution Pipeline |
| `docs/types/combatEvent.md` | Vollstaendige Spezifikation |
| `src/types/entities/combatEvent.ts` | TypeScript Schema |
