# Schema: Species

> **Produziert von:** [Library](../views/Library.md) (CRUD), Presets (bundled)
> **Konsumiert von:** [NPC-Generation](../services/npcs/NPC-Generation.md), Creature (species-Feld)

Biologische/physische Definition einer Kreaturenart.

---

## Konzept-Trennung

Species, Culture und Faction sind drei unabhaengige Entity-Typen mit unterschiedlichen Verantwortlichkeiten:

| Entity | Verantwortung | Typ | Beispiele |
|--------|---------------|-----|-----------|
| **Species** | Biologisch/physisch | Angeboren | appearance, defaultSize |
| **Culture** | Erlernt/sozial | Erworben | naming, personality, values, speech, styling |
| **Faction** | Organisatorisch | Mitgliedschaft | influence, goals, Hierarchie |

**Beispiel:**
- Ein Goblin (Species) kann einer Diebesgilde (Faction) beitreten
- Er behaelt seine gruene Haut und spitzen Ohren (Species.appearance)
- Aber uebernimmt die Kleidung und Sitten der Gilde (Culture.styling)
- Und wird von deren Zielen beeinflusst (Faction.influence)

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | string | Eindeutige ID | Required, non-empty |
| name | string | Anzeigename | Required, non-empty |
| appearance | LayerTraitConfig | Physische Merkmale | Optional |
| defaultSize | Size | Basis-Groesse | Optional |
| defaultCulture | string | Culture-ID Fallback | Optional |
| description | string | GM-Referenz | Optional |

---

## Eingebettete Typen

### appearance

Physische Merkmale, die alle Creatures dieser Species teilen.

```typescript
appearance: LayerTraitConfig  // { add?: string[], unwanted?: string[] }
```

**Beispiele:**

| Species | appearance.add |
|---------|----------------|
| Goblin | `['sharp_teeth', 'missing_teeth', 'yellow_eyes', 'crooked_nose', 'missing_ear']` |
| Human | `['scarred_face', 'weathered_skin', 'long_hair', 'bald', 'muscular']` |
| Wolf | `['matted_fur', 'patchy_fur', 'scarred_body', 'long_claws', 'missing_eye']` |

**Wichtig:** Creatures erben automatisch die appearance ihrer Species. Creature-spezifische Ergaenzungen werden via `appearanceOverride` definiert.

### defaultSize

Basis-Groesse fuer Creatures dieser Species.

```typescript
type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
```

| Species | defaultSize |
|---------|-------------|
| Goblin | `small` |
| Human | `medium` |
| Owlbear | `large` |

**Hinweis:** Creatures koennen ihre eigene `size` definieren, die die defaultSize ueberschreibt.

### defaultCulture

Culture-ID, die als Fallback verwendet wird, wenn keine Faction-Culture verfuegbar ist.

```typescript
defaultCulture: 'species:goblin'  // Verweist auf Culture-Entity
```

Wird bei NPC-Generierung verwendet, wenn:
- NPC keiner Faction angehoert
- Faction keine usualCultures definiert hat

---

## Vererbung bei Creatures

Creatures referenzieren Species via `species` Feld:

```typescript
// Creature-Definition
{
  id: 'goblin',
  species: 'goblin',  // ← Referenz auf Species-Entity
  // appearance wird von Species 'goblin' geerbt
}
```

**Resolution bei NPC-Generierung:**

```
1. Creature laden (z.B. 'goblin')
2. Species laden (creature.species → 'goblin')
3. Appearance = Species.appearance + Creature.appearanceOverride
4. Culture auswaehlen (Faction.usualCultures oder Species.defaultCulture)
5. Personality, Values, Naming aus Culture
6. Faction.influence anwenden
```

---

## Beispiele

### Goblin Species

```typescript
const goblinSpecies: Species = {
  id: 'goblin',
  name: 'Goblin',
  appearance: {
    add: ['sharp_teeth', 'missing_teeth', 'yellow_eyes', 'crooked_nose', 'missing_ear'],
  },
  defaultSize: 'small',
  defaultCulture: 'species:goblin',
};
```

### Wolf Species (Beast)

```typescript
const wolfSpecies: Species = {
  id: 'wolf',
  name: 'Wolf',
  appearance: {
    add: ['matted_fur', 'patchy_fur', 'scarred_body', 'long_claws', 'missing_eye'],
  },
  defaultSize: 'medium',
  // Kein defaultCulture - Beasts haben keine Kultur
};
```

### Skeleton Species (Undead)

```typescript
const skeletonSpecies: Species = {
  id: 'skeleton',
  name: 'Skeleton',
  appearance: {
    add: ['skeletal', 'rotting', 'glowing_eyes', 'missing_limb', 'milky_eyes'],
  },
  defaultSize: 'medium',
  defaultCulture: 'species:skeleton',
};
```

---

## Invarianten

- `id` muss eindeutig sein
- `defaultCulture` muss auf existierende Culture verweisen (falls gesetzt)
- `appearance.add` sollte nur valide Trait-IDs enthalten
- Creatures ohne `species` erben keine appearance

---

## Storage

```
Vault/SaltMarcher/data/
├── species/
│   ├── _bundled/           # Mitgelieferte Species
│   │   ├── goblin.json
│   │   ├── human.json
│   │   └── wolf.json
│   └── user/               # User-erstellte Species
│       └── custom-species.json
```

---

## Siehe auch

- [creature.md](creature.md) - Referenziert Species via `species` Feld
- [culture.md](culture.md) - Kulturelle Attribute (von Species getrennt)
- [faction.md](faction.md) - Organisatorische Zugehoerigkeit
- [NPC-Generation.md](../services/npcs/NPC-Generation.md) - Verwendung bei NPC-Erstellung
