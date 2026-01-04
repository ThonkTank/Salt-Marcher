# Schema: Culture

> **Produziert von:** [Library](../views/Library.md) (CRUD), Presets (bundled)
> **Konsumiert von:** [NPC-Generation](../services/npcs/NPC-Generation.md), [Culture-Resolution](../services/npcs/Culture-Resolution.md)

Eigenstaendige Entity fuer kulturelle Identitaet - unabhaengig von Creature-Type und Faction.

---

## Konzept

Culture ist von Creature und Faction entkoppelt:

| Aspekt | Quelle | Beispiele |
|--------|--------|-----------|
| **Physische Attribute** | Species (appearance) | Augenfarben, Hautfarben, Koerperbau |
| **Kulturelle Marker** | Culture (styling) | Kleidung, Schmuck, Huete, Tattoos |
| **Persoenlichkeit** | Culture | Traits, Values, Quirks, Goals |
| **Fraktions-Einfluss** | Faction (influence) | Erweitert Pools, ueberschreibt nicht |

**Beispiel:** Ein Ork kann:
- Stadtkind sein (imperiale Kultur)
- Stammesmitglied sein (Jaeger-Sammler-Kultur)
- Akademiker sein (Gelehrten-Kultur)

Und dann einer Abenteurergilde beitreten, ohne seine Herkunftskultur zu verlieren.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'culture'> | Eindeutige ID | Required |
| name | string | Anzeigename | Required, non-empty |
| parentId | EntityId<'culture'> | Sub-Culture von | Optional, muss existieren |
| usualSpecies | string[] | Typische Spezies dieser Kultur | Optional |
| tolerance | number | Wie offen gegenueber anderen Spezies (0-1) | Optional, default: 0.3 |
| styling | LayerTraitConfig | Kulturelle Marker (Kleidung, Schmuck) | Optional |
| personality | LayerTraitConfig | Persoenlichkeits-Traits | Optional |
| values | LayerTraitConfig | Werte und Prioritaeten | Optional |
| quirks | LayerTraitConfig | Eigenheiten | Optional |
| goals | LayerTraitConfig | Typische Ziele | Optional |
| naming | NamingConfig | Namensgenerierung | Optional |
| speech | SpeechConfig | Sprach-RP-Hinweise | Optional |
| activities | string[] | Activity-IDs (fuer Encounter) | Optional |
| description | string | Beschreibung | Optional |

---

## Eingebettete Typen

### parentId

Kulturen koennen hierarchisch verschachtelt sein (wie Factions).

```typescript
parentId: 'culture:imperial'  // Diese Kultur ist eine Sub-Kultur von "imperial"
```

**Beispiel-Hierarchie:**

```
human-generic
  └── imperial
        ├── imperial-military
        └── imperial-noble
  └── rural
        └── rural-farmer
```

**Effekt bei NPC-Generierung:**

Wenn eine Fraktion eine spezifische Kultur bevorzugt (z.B. `imperial-military`), erhalten deren Parent-Kulturen einen abnehmenden Boost:

| Kultur ist... | Boost | Beispiel |
|---------------|-------|----------|
| usualCulture selbst | Step 1 (factionWeight) | `imperial-military` |
| Direct Parent | weight × 3 | `imperial` |
| Grandparent | weight × 2 | `human-generic` |
| Great-Grandparent | weight × 1.5 | usw. |

→ Algorithmus: [Culture-Resolution.md](../services/npcs/Culture-Resolution.md#step-4-ancestor-boost)

### usualSpecies

Welche Spezies typischerweise Teil dieser Kultur sind.

```typescript
usualSpecies: ['human', 'halfling', 'dwarf']
```

Wird fuer Culture-Selection verwendet:
- Creature mit passender Species → Kultur wird bevorzugt
- Creature mit anderer Species → Kultur wird durch tolerance moduliert

### tolerance

Wie offen ist diese Kultur gegenueber Nicht-usualSpecies?

| tolerance | Bedeutung | Beispiel |
|-----------|-----------|----------|
| 0% | Nur usualSpecies | Xenophober Stamm |
| 30% | Hauptsaechlich usualSpecies (default) | Traditionelle Kultur |
| 100% | Alle Spezies willkommen | Kosmopolitische Stadt |

**Effekt bei NPC-Generierung:**

Wenn Fraktion diverse Spezies akzeptiert:
- Intollerante Kultur (0%) → tritt Fraktion nicht bei
- Tolerante Kultur (100%) → kein Problem mit Diversitaet

→ Details: [Culture-Resolution.md](../services/npcs/Culture-Resolution.md)

### LayerTraitConfig

Fuer alle Attribut-Felder (styling, personality, values, quirks, goals).

```typescript
interface LayerTraitConfig {
  add?: string[];      // Trait-IDs die Gewicht erhalten
  unwanted?: string[]; // Trait-IDs deren Gewicht reduziert wird
}
```

### NamingConfig

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| patterns | string[] | z.B. `["{prefix}{root}", "{root} {title}"]` |
| prefixes | string[] | Namenspraefixe |
| roots | string[] | Namens-Staemme |
| suffixes | string[] | Namenssuffixe |
| titles | string[] | Titel wie "der Grausame" |

### SpeechConfig

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| dialect | string | "formell", "grob", "blumig" |
| commonPhrases | string[] | Typische Redewendungen |
| accent | string | Beschreibung des Akzents |

---

## Culture-Selection Algorithmus

Bei NPC-Generierung wird die Kultur per Weighted Pool ausgewaehlt:

```
1. Faction.usualCultures zum Pool
   baseWeight = 100 + FACTION_BOOST * (1 - factionTolerance)

2. Alle anderen Kulturen zum Pool
   baseWeight = 1

3. Species-Kompatibilitaet pruefen
   Wenn creature.species IN culture.usualSpecies:
     weight *= 1 + SPECIES_BOOST * (1 - cultureTolerance)

4. Kultur-Fraktions-Kompatibilitaet
   Wenn Fraktion Species akzeptiert NOT IN culture.usualSpecies:
     weight *= culture.tolerance

5. Ancestor-Boost
   Fuer jede usualCulture: Parent-Kette nach oben aufloesen
   Ancestors erhalten abnehmenden Boost: weight *= 1 + (PARENT_BOOST-1) / 2^(depth-1)
```

→ Vollstaendiger Algorithmus: [Culture-Resolution.md](../services/npcs/Culture-Resolution.md)

---

## Invarianten

- `parentId` muss auf existierende Culture verweisen (keine Zyklen)
- `tolerance` muss im Bereich 0.0-1.0 liegen
- `usualSpecies` leer = Kultur ist fuer alle Spezies geeignet
- Bei leeren Trait-Listen werden Fallbacks verwendet

---

## Beispiele

### Hierarchische Imperiale Kulturen

```typescript
// Parent-Kultur (allgemein)
const imperialCulture: Culture = {
  id: 'culture:imperial',
  name: 'Imperiale Kultur',
  usualSpecies: ['human'],
  tolerance: 0.5,
  values: { add: ['order', 'duty', 'empire'] },
};

// Child-Kultur (spezialisiert)
const imperialMilitaryCulture: Culture = {
  id: 'culture:imperial-military',
  name: 'Imperiale Militaer-Kultur',
  parentId: 'culture:imperial',  // ← Verweist auf Parent
  usualSpecies: ['human'],
  tolerance: 0.3,
  styling: { add: ['uniform', 'medals', 'short_hair'] },
  values: { add: ['discipline', 'loyalty', 'strength'] },
};
```

### Xenophobe Stammeskultur

```typescript
const orcTribalCulture: Culture = {
  id: 'culture:orc-tribal',
  name: 'Ork-Stammes-Kultur',
  usualSpecies: ['orc', 'half-orc'],
  tolerance: 0,  // Keine Fremden

  styling: {
    add: ['war_paint', 'bone_jewelry', 'leather_armor'],
  },
  personality: {
    add: ['aggressive', 'proud', 'territorial'],
    unwanted: ['cowardly', 'submissive'],
  },
  values: {
    add: ['strength', 'honor', 'clan'],
  },
  naming: {
    patterns: ['{root}', '{prefix}{root}'],
    prefixes: ['Grok', 'Morg', 'Thrak'],
    roots: ['nash', 'gul', 'rok', 'zar'],
  },
};
```

### Kosmopolitische Handelsstadt

```typescript
const cosmopolitanCulture: Culture = {
  id: 'culture:trade-city',
  name: 'Hafenstadt-Kultur',
  usualSpecies: ['human', 'dwarf', 'elf', 'halfling', 'gnome'],
  tolerance: 1.0,  // Alle willkommen

  styling: {
    add: ['fine_clothes', 'jewelry', 'colorful_fabrics'],
  },
  personality: {
    add: ['pragmatic', 'curious', 'opportunistic'],
  },
  values: {
    add: ['profit', 'connections', 'reputation'],
  },
  naming: {
    patterns: ['{root} {title}', '{prefix}{root}'],
    prefixes: ['Van ', 'De ', 'Al-'],
    roots: ['Marcus', 'Helena', 'Rashid', 'Chen'],
    titles: ['der Haendler', 'die Seefahrerin'],
  },
};
```

---

## Storage

```
Vault/SaltMarcher/data/
├── culture/
│   ├── _bundled/           # Mitgelieferte Kulturen
│   │   ├── imperial.json
│   │   ├── tribal-orc.json
│   │   └── cosmopolitan.json
│   └── user/               # User-erstellte Kulturen
│       └── custom-culture.json
```

---

## Migration von CultureData

Die bisherige eingebettete `CultureData` in Faction wird zu:

| Alt (Faction.culture) | Neu |
|-----------------------|-----|
| Vollstaendige CultureData | Faction.usualCultures (Referenzen) |
| personality, values, etc. | Culture-Entity (eigenstaendig) |
| - | Faction.influence (nur Erweiterung) |

→ Migrations-Details: [Culture-Resolution.md](../services/npcs/Culture-Resolution.md)

---

## Abgrenzung zu Species

Species und Culture sind zwei getrennte Entity-Typen:

| Aspekt | Species | Culture |
|--------|---------|---------|
| **Typ** | Biologisch/angeboren | Erlernt/sozial |
| **Beispiele** | Gelbe Augen, gruene Haut | Kriegerische Kleidung, Tattoos |
| **Vererbung** | Alle Creatures einer Species | Per NPC-Generierung ausgewaehlt |
| **Aenderbar** | Nein (biologisch) | Ja (sozialer Kontext) |
| **Entity-Referenz** | `creature.species` | `faction.usualCultures` |

**Beispiel:**
Ein Goblin hat immer spitze Ohren und gelbe Augen (Species.appearance), aber je nach Kultur traegt er Stammestattoos oder Gildenkleidung (Culture.styling).

→ Species-Entity: [species.md](species.md)

---

## Siehe auch

- [species.md](species.md) - Physische Attribute (appearance)
- [creature.md](creature.md) - Referenziert Species via `species` Feld
- [faction.md](faction.md) - usualCultures und influence
- [Culture-Resolution.md](../services/npcs/Culture-Resolution.md) - Selection-Algorithmus
- [NPC-Generation.md](../services/npcs/NPC-Generation.md) - Verwendung bei NPC-Erstellung
