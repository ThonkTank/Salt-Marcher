# Schema: CultureData

> **Produziert von:** [Faction](faction.md) (eingebettet)
> **Konsumiert von:** [NPC-Generation](../services/NPCs/NPC-Generation.md) (Name/Personality-Generierung)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| naming | NamingConfig | Namensgenerierung | Optional |
| personality | PersonalityConfig | Persoenlichkeits-Pools | Optional |
| quirks | WeightedQuirk[] | Eigenheiten-Pool | Optional |
| activities | string[] | Activity-IDs (keine Gewichtung) | Optional, -> [activity.md](activity.md) |
| goals | WeightedGoal[] | NPC-Ziele-Pool | Optional |
| values | ValuesConfig | Werte & Verhalten | Optional |
| speech | SpeechConfig | Sprach-RP-Hinweise | Optional |

## Eingebettete Typen

### NamingConfig

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| patterns | string[] | z.B. `["{prefix}{root}", "{root} {title}"]` |
| prefixes | string[] | Namenspraefixe |
| roots | string[] | Namens-Staemme |
| suffixes | string[] | Namenssuffixe |
| titles | string[] | Titel wie "der Grausame" |

### PersonalityConfig

Traits werden zentral in `presets/traits/` definiert und per ID referenziert.
Soft-Weighting: Alle Traits sind immer im Pool, aber mit unterschiedlichen Gewichten.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| traits | string[] | Bevorzugte Trait-IDs (5x Gewicht) |
| forbidden | string[] | Benachteiligte Trait-IDs (0.2x Gewicht) |

**Gewichtungs-Modell:**
- In `traits` gelistet → 5x Gewicht (bevorzugt)
- Nicht gelistet → 1x Gewicht (neutral)
- In `forbidden` → 0.2x Gewicht (benachteiligt, aber nicht ausgeschlossen)

Siehe: [presets/traits/](../../presets/traits/) fuer zentrale Trait-Definitionen

### WeightedQuirk

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| quirk | string | Quirk-ID |
| weight | number | Gewichtung 0.0-1.0 |
| description | string | GM-Beschreibung fuer RP |
| compatibleTags | string[] | Kreatur-Tags fuer Kompatibilitaet |

### WeightedGoal

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| goal | string | z.B. "loot", "protect_territory", "find_food" |
| weight | number | Gewichtung |
| description | string | GM-Beschreibung |
| personalityBonus | PersonalityBonusEntry[] | Bonus bei passender Personality |

### PersonalityBonusEntry

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| trait | string | z.B. "greedy" |
| multiplier | number | z.B. 2.0 (verdoppelt Gewichtung) |

### ValuesConfig

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| priorities | string[] | ["Ehre", "Familie", "Gold", ...] |
| taboos | string[] | Was ist verpoent |
| greetings | string[] | Typische Begruessungen |

### SpeechConfig

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| dialect | string | "formell", "grob", "blumig" |
| commonPhrases | string[] | Typische Redewendungen |
| accent | string | Beschreibung des Akzents |

## Invarianten

- Alle `weight` Werte im Bereich 0.0-1.0
- `compatibleTags` leer = fuer alle Kreaturen geeignet
- Merge-Logik: → [Culture-Resolution.md](../services/NPCs/Culture-Resolution.md)

---

## Beispiel

```typescript
const goblinCulture: CultureData = {
  naming: {
    patterns: ['{prefix}{root}', '{root}{suffix}'],
    prefixes: ['Grik', 'Snag', 'Muk', 'Zit'],
    roots: ['nak', 'gob', 'rik', 'snik'],
    suffixes: ['le', 'ik', 'az', 'uz']
  },
  personality: {
    traits: ['cunning', 'cowardly', 'greedy', 'cruel', 'nervous', 'brave', 'loyal', 'clever'],
    // forbidden: ['kindhearted'] // Optional: benachteiligte Traits
  },
  quirks: [
    { quirk: 'nervous_laugh', weight: 0.3, description: 'Kichert nervoes' },
    { quirk: 'hoards_shiny', weight: 0.4, description: 'Sammelt Glaenzendes' }
  ],
  activities: ['ambush', 'scavenge', 'camp', 'patrol', 'feeding'],
  values: {
    priorities: ['survival', 'loot', 'pleasing_boss'],
    taboos: ['direct_confrontation', 'sharing_treasure']
  },
  speech: {
    dialect: 'broken',
    commonPhrases: ['Nicht toeten!', 'Hab Schatz!', 'Boss sagt...'],
    accent: 'hoch, schnell, nervoes'
  }
};
```
