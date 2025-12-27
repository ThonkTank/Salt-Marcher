# NPC-Resolution

> **Zurueck zu:** [Encounter](Encounter.md)
> **Empfaengt von:** [Population](Population.md) - `EncounterDraft`
> **Liefert an:** [Flavour](Flavour.md) - `EncounterDraft` mit NPCs
> **Schema:** [npc.md](../../data/npc.md)

Wie werden existierende NPCs wiederverwendet oder neue generiert?

**Verantwortlichkeit:** Step 3.5 der 7-Step-Pipeline - NPC-Aufloesung nach Gruppen-Befuellung.

**Design-Philosophie:** Das Plugin automatisiert Mechanik (Generierung, Matching, Status). Der GM macht die kreative Arbeit (was die Party weiss, Beziehungen, Story). Encounter-Historie wird ueber Journal-Entries im Almanac abgebildet, nicht im NPC-Schema.

---

## Uebersicht

Das NPC-System sorgt dafuer, dass die Spielwelt konsistent und lebendig wirkt:

1. **Existierende NPCs bevorzugen** - Bekannte Gesichter wiederverwenden
2. **Neue NPCs generieren** - Mit kulturellen Merkmalen aus der Faction-Hierarchie
3. **NPCs persistieren** - Einmal generierte NPCs bleiben erhalten

```
┌─────────────────────────────────────────────────────────────────┐
│  Encounter braucht NPC                                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Suche passenden existierenden NPC                           │
│     ├── Gleiche Kreaturart                                      │
│     ├── Passende Fraktion                                       │
│     └── Verfuegbar (nicht tot)                                  │
├─────────────────────────────────────────────────────────────────┤
│  2. Falls keiner gefunden: Generiere neuen NPC                  │
│     ├── Name aus Faction-Kultur                                 │
│     ├── Persoenlichkeit aus Faction-Kultur                      │
│     └── Persistiere via EntityRegistry                          │
├─────────────────────────────────────────────────────────────────┤
│  3. Aktualisiere NPC-Daten                                      │
│     └── lastEncounter, encounterCount                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Storage & Retrieval

NPCs werden im EntityRegistry gespeichert und ueber definierte Kriterien wiedergefunden.

### Speicherung

NPCs werden als JSON-Dateien im Vault persistiert:

```
Vault/SaltMarcher/data/
└── npc/
    ├── griknak-blutfang.json
    ├── merchant-silverbeard.json
    └── guard-captain-helena.json
```

**Speicherungs-Trigger:**
- Lead-NPC wird bei Encounter generiert → Sofort persistiert
- GM erstellt NPC manuell in Library → Sofort persistiert
- NPC-Status aendert sich (alive → dead) → Update persistiert

### Retrieval: findExistingNPC()

Bei Encounter-Generierung wird nach passenden existierenden NPCs gesucht:

```typescript
function findExistingNPC(
  creatureId: EntityId<'creature'>,
  factionId?: EntityId<'faction'>
): Option<NPC> {
  return entityRegistry.query('npc', npc =>
    npc.creature.id === creatureId &&
    npc.factionId === factionId &&
    npc.status === 'alive'
  ).first();
}
```

**Match-Kriterien:**

| Kriterium | Beschreibung |
|-----------|--------------|
| `creature.id` | Gleicher Kreatur-Typ (z.B. goblin-warrior) |
| `factionId` | Gleiche Fraktion (z.B. blutfang-tribe) |
| `status` | Muss 'alive' sein (tote NPCs werden nicht wiederverwendet) |

**Priorisierung bei mehreren Matches:**

```typescript
function selectBestMatch(
  candidates: NPC[],
  encounterPosition: HexCoordinate
): NPC {
  // Primaer: Geografisch naechster NPC
  // Sekundaer: Wer wurde laenger nicht gesehen?
  return candidates.sort((a, b) => {
    // 1. Geografische Naehe (wenn Position bekannt)
    const distA = a.lastKnownPosition
      ? hexDistance(encounterPosition, a.lastKnownPosition)
      : Infinity;
    const distB = b.lastKnownPosition
      ? hexDistance(encounterPosition, b.lastKnownPosition)
      : Infinity;

    if (distA !== distB) return distA - distB;

    // 2. Fallback: Wer wurde laenger nicht gesehen?
    return a.lastEncounter.timestamp - b.lastEncounter.timestamp;
  })[0];
}
```

### NPC-Registry Queries

Haeufige Abfragen:

```typescript
// Alle NPCs einer Fraktion
entityRegistry.query('npc', npc => npc.factionId === factionId);

// Alle lebenden NPCs an einem POI
entityRegistry.query('npc', npc =>
  npc.status === 'alive' && npc.currentPOI === poiId
);

// NPC mit hoechstem Encounter-Count (bekanntester NPC)
entityRegistry.query('npc', () => true)
  .sort((a, b) => b.encounterCount - a.encounterCount)[0];
```

### Wiederverwendung vs. Neu-Generierung

| Situation | Verhalten |
|-----------|-----------|
| Passender NPC existiert | Wiederverwendung: `lastEncounter` + `encounterCount` aktualisieren |
| Kein passender NPC | Neu-Generierung: Name, Persoenlichkeit, Quirk aus Kultur |
| NPC wurde getoetet | Status auf 'dead', nicht mehr fuer Matches verfuegbar |

---

## NPC-Auswahl-Algorithmus

Bei jedem Encounter wird geprueft, ob ein existierender NPC passt:

### Match-Kriterien

```typescript
interface NPCMatchCriteria {
  creatureType: string;                 // Muss uebereinstimmen
  factionId: EntityId<'faction'>;       // Muss uebereinstimmen
}

function findMatchingNPC(
  criteria: NPCMatchCriteria,
  context: EncounterContext
): NPC | null {
  const candidates = entityRegistry.query('npc', npc =>
    npc.creature.type === criteria.creatureType &&
    npc.status === 'alive' &&
    npc.factionId === criteria.factionId
  );

  if (candidates.length === 0) return null;

  // Scoring: Bevorzuge NPCs die laenger nicht gesehen wurden
  const scored = candidates.map(npc => ({
    npc,
    score: calculateMatchScore(npc, context)
  }));

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score > MATCH_THRESHOLD) {
    return best.npc;
  }

  return null;
}

function calculateMatchScore(npc: NPC, context: EncounterContext): number {
  let score = 10;  // Basis-Score fuer existierenden NPC

  // Wiedersehen ist interessanter
  if (npc.encounterCount > 0) score += 15;

  // Kuerzlich getroffen = weniger wahrscheinlich (Abwechslung)
  const daysSinceLastEncounter = getDaysSince(npc.lastEncounter, context.currentTime);
  if (daysSinceLastEncounter < 3) score -= 30;    // Zu kuerzlich
  if (daysSinceLastEncounter > 30) score += 10;   // Lange her

  return score;
}
```

---

## NPC-Generierung

Wenn kein passender existierender NPC gefunden wird:

```typescript
function generateNewNPC(
  creature: Creature,
  context: EncounterContext,
  usedQuirks: Set<string>  // Tracking fuer Einzigartigkeit
): NPC {
  // Faction holen (required)
  const faction = entityRegistry.get('faction', creature.factionId);

  // Kultur aus Faction-Hierarchie aufloesen
  const culture = resolveFactionCulture(faction);

  // Name generieren aus Kultur
  const name = generateNameFromCulture(culture);

  // Persoenlichkeit wuerfeln
  const personality = rollPersonalityFromCulture(culture);

  // Quirk (100% - jeder NPC bekommt einen, gefiltert nach Kreatur-Kompatibilitaet)
  const quirk = rollQuirkFromCulture(culture, creature, usedQuirks);

  // Persoenliches Ziel mit Pool-Hierarchie + Persoenlichkeits-Gewichtung
  const personalGoal = selectPersonalGoal(creature, culture, personality, context);

  const npc: NPC = {
    id: createEntityId('npc'),
    name,
    creature: { type: creature.type, id: creature.id },
    factionId: creature.factionId,   // Immer von Creature uebernommen
    personality,
    quirk,
    personalGoal,
    status: 'alive',
    firstEncounter: context.currentTime,
    lastEncounter: context.currentTime,
    encounterCount: 1
  };

  // Persistieren via EntityRegistry
  entityRegistry.save('npc', npc);

  return npc;
}
```

### Kultur-Aufloesung

```typescript
// Kultur-Aufloesung: Faction-Hierarchie oder Creature-Tags Fallback
function resolveCultureForNPC(
  creature: CreatureDefinition,
  faction: Faction | null
): ResolvedCulture {
  if (faction) {
    return resolveFactionCulture(faction);
  }
  // Fallback fuer fraktionslose Kreaturen
  return buildCultureFromCreatureTags(creature);
}

function buildCultureFromCreatureTags(creature: CreatureDefinition): ResolvedCulture {
  // Creature-Tags bestimmen Naming-Pattern und Basis-Personality
  // z.B. tags: ['beast', 'predator'] → aggressive Personality, keine Sprache
  const isBeast = creature.tags?.includes('beast');
  const isPredator = creature.tags?.includes('predator');

  return {
    naming: {
      patterns: ['{root}'],
      roots: creature.names ?? [creature.type]  // Fallback auf Kreatur-Typ
    },
    personality: {
      common: [
        { trait: isPredator ? 'aggressive' : 'neutral', weight: 0.8 },
        { trait: isBeast ? 'territorial' : 'cautious', weight: 0.6 }
      ],
      rare: [],
      forbidden: isBeast ? ['social', 'cunning'] : []
    },
    quirks: creature.quirks ?? [],
    values: { priorities: ['survival'], taboos: [] },
    speech: isBeast ? undefined : { dialect: 'simple' }
  };
}

function resolveFactionCulture(faction: Faction): ResolvedCulture {
  const chain: Faction[] = [];
  let current: Faction | null = faction;

  while (current) {
    chain.push(current);
    current = current.parentId
      ? entityRegistry.get('faction', current.parentId)
      : null;
  }

  // Von root nach leaf mergen
  return chain.reverse().reduce(
    (base, f) => mergeCultureData(base, f.culture),
    {} as ResolvedCulture
  );
}
```

→ Culture-Schema: [culture-data.md](../../data/culture-data.md)

---

## Goal-Pool-Hierarchie

Das persoenliche Ziel eines NPCs wird aus mehreren Quellen zusammengestellt:

```
Generischer Pool (alle Kreaturen)
    ↓ erweitert durch
Creature-Typ Pool (z.B. Wolf: find_food, protect_pack)
    ↓ erweitert durch
Fraktion Pool (z.B. Blutfang: please_blood_god, conquer)
    ↓ gewichtet durch
Persoenlichkeit (greedy → loot×2, cowardly → survive×2)
```

```typescript
function selectPersonalGoal(
  creature: CreatureDefinition,
  culture: ResolvedCulture,
  personality: PersonalityTraits,
  context: EncounterContext
): string {
  // 1. Pools zusammenstellen
  const genericPool = GENERIC_GOALS;                    // System-Default
  const creaturePool = creature.goals ?? [];            // Creature-spezifisch
  const culturePool = culture.goals ?? [];              // Fraktion-spezifisch

  const combinedPool = [...genericPool, ...creaturePool, ...culturePool];

  // 2. Persoenlichkeits-Gewichtung anwenden
  const weighted = combinedPool.map(g => {
    let weight = g.weight;

    // Bonus fuer passende Persoenlichkeit
    if (g.personalityBonus) {
      for (const bonus of g.personalityBonus) {
        if (personality.primary === bonus.trait || personality.secondary === bonus.trait) {
          weight *= bonus.multiplier;
        }
      }
    }

    return { ...g, weight };
  });

  return weightedRandomSelect(weighted).goal;
}
```

**Beispiel:** Ein Goblin mit `personality: { primary: 'greedy', secondary: 'cowardly' }`:
- "loot" Goal hat `personalityBonus: [{ trait: 'greedy', multiplier: 2.0 }]` → Gewichtung verdoppelt
- "help_others" Goal hat keine Bonus → normale Gewichtung (sehr unwahrscheinlich)

---

## Quirk-Einzigartigkeit

Quirks werden getrackt um Wiederholungen zu vermeiden:

```typescript
// Session-weites Tracking
const usedQuirks = new Set<string>();

// Bei NPC-Generierung
const quirk = rollQuirkFromCulture(culture, creature, usedQuirks);
// → usedQuirks wird um den ausgewaehlten Quirk erweitert

// Bei erschoepftem Pool: Wiederholung erlaubt
```

---

## NPC-Lifecycle

### Status-Uebergaenge

```
┌───────────────────┐
│      alive        │
└─────────┬─────────┘
          │
          ▼
    ┌───────────┐
    │   dead    │
    └───────────┘
```

**Vereinfacht:** Nur `alive` und `dead`. Komplexere Stati (`missing`, `imprisoned`, `traveling`) kann der GM in Notizen tracken.

### Encounter-Nachbereitung

Nach jedem Encounter werden NPC-Daten aktualisiert:

```typescript
function updateNPCAfterEncounter(
  npc: NPC,
  encounter: EncounterInstance,
  outcome: EncounterOutcome
): void {
  // Tracking aktualisieren
  npc.lastEncounter = encounter.generatedAt;
  npc.encounterCount++;

  // Position-Tracking aktualisieren (fuer geografische NPC-Auswahl)
  npc.lastKnownPosition = encounter.context.position;
  npc.lastSeenAt = encounter.generatedAt;

  // Status aendern falls NPC getoetet wurde
  if (outcome.npcKilled?.includes(npc.id)) {
    npc.status = 'dead';
  }

  entityRegistry.save('npc', npc);

  // Journal-Entry wird separat erstellt (Almanac-Feature)
  // und kann mit diesem NPC verlinkt werden
}
```

---

## Integration mit Encounters

### Lead-NPC Auswahl

```typescript
function selectOrGenerateLeadNPC(
  creature: Creature,
  context: EncounterContext
): EncounterLeadNPC {
  // 1. Versuche existierenden NPC zu finden
  const existingNPC = findMatchingNPC({
    creatureType: creature.type,
    factionId: creature.factionId   // Immer vorhanden (required)
  }, context);

  let npc: NPC;

  if (existingNPC) {
    npc = existingNPC;
  } else {
    npc = generateNewNPC(creature, context);
  }

  // In Encounter-Format konvertieren
  return {
    npcId: npc.id,
    creature,
    name: npc.name,
    personality: npc.personality,
    personalGoal: npc.personalGoal,
    quirk: npc.quirk,
    isRecurring: npc.encounterCount > 1
  };
}
```

### Multi-Gruppen-Encounters

Bei Multi-Gruppen-Encounters wird fuer **jede Gruppe** ein Lead-NPC bestimmt. Highlight-NPCs werden **global limitiert** (max 3 pro Encounter).

```typescript
function resolveMultiGroupNPCs(
  encounter: MultiGroupEncounter,
  context: EncounterContext
): MultiGroupEncounter {
  let totalHighlights = 0;
  const MAX_HIGHLIGHTS = 3; // GLOBAL, nicht pro Gruppe!

  for (const group of encounter.groups) {
    // Lead-NPC: Immer einer pro Gruppe (wird persistiert)
    group.leadNPC = selectOrGenerateLeadNPC(group.creatures[0], context);

    // Highlight-NPC: Max 3 insgesamt ueber alle Gruppen
    if (group.creatures.length > 1 && totalHighlights < MAX_HIGHLIGHTS) {
      group.highlightNPCs = [generateHighlightNPC(group.creatures[1], context)];
      totalHighlights++;
    }
  }
  return encounter;
}
```

**NPC-Limits bei Multi-Gruppen:**

| NPC-Typ | Limit | Persistiert? |
|---------|-------|--------------|
| Lead-NPC | 1 pro Gruppe | Ja |
| Highlight-NPC | max 3 **GLOBAL** | Nein |
| Anonym | Unbegrenzt | Nein |

**Begruendung:** Der GM sollte nie mehr als ~3-4 benannte NPCs gleichzeitig tracken muessen. Bei 2 Gruppen mit je 1 Lead + 1 Highlight = 4 benannte NPCs (akzeptabel).

**Beispiel bei 3 Gruppen:**
```
Gruppe 1: Banditen (5)
├── Lead: Rotbart (persistiert)
├── Highlight: Narbengesicht
└── Anonym: ×3

Gruppe 2: Gefangene (3)
├── Lead: Meister Goldwein (persistiert)
├── Highlight: Lena die Magd
└── Anonym: ×1

Gruppe 3: Woelfe (4)
├── Lead: Silberfang (persistiert)
└── Anonym: ×3  ← Kein Highlight mehr (Limit erreicht)

Total: 3 Leads + 2 Highlights = 5 benannte NPCs
```

→ Multi-Group-Details: [Population.md#multi-group-encounters](Population.md#multi-group-encounters)

---

## Erweiterungen

| Feature | Beschreibung |
|---------|--------------|
| **Stat-Overrides** | Vollstaendige Stat-Anpassungen, UI vom Creature-Editor |
| NPC-Routen | Wandernde NPCs (Haendler, Patrouillen) mit definierten Routen |
| NPC-Schedules | Tagesablauf-basierte Location (Morgens im Laden, Abends in Taverne) |
| `homeLocation` | NPC hat Heimat-Tile mit Radius-Bonus fuer Erscheinen |
| Faction-lose NPCs | Einsiedler, Wanderer ohne Faction |
| NPC-Agency | NPCs bewegen sich zur Runtime selbststaendig |

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
