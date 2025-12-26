# NPC-System

> **Lies auch:** [Creature](Creature.md), [Faction](Faction.md)
> **Wird benoetigt von:** Encounter, Quest, Shop

Verwaltung von NPCs: Auswahl existierender NPCs, Generierung neuer NPCs, Persistierung.

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

## NPC-Schema

NPCs werden im EntityRegistry gespeichert (`EntityType: 'npc'`).

```typescript
interface NPC {
  id: EntityId<'npc'>;

  // === Basis-Daten ===
  name: string;
  creature: CreatureRef;                // Verweis auf Kreatur-Template
  factionId?: EntityId<'faction'>;      // Optional - wenn gesetzt: Kultur aus Faction
                                         // Wenn nicht: Fallback auf Creature-Tags

  // === Persoenlichkeit (generiert aus Faction-Kultur) ===
  personality: PersonalityTraits;
  quirk?: string;
  personalGoal: string;

  // === Status ===
  status: 'alive' | 'dead';

  // === Tracking (fuer Wiedererkennung) ===
  firstEncounter: GameDateTime;
  lastEncounter: GameDateTime;
  encounterCount: number;

  // === Position-Tracking (fuer geografische NPC-Auswahl) ===
  lastKnownPosition?: HexCoordinate;    // Letzte bekannte Position (aktualisiert bei Encounter)
  lastSeenAt?: GameDateTime;            // Zeitpunkt der letzten Sichtung

  // === Optionale explizite Location (MVP, niedrige Prio) ===
  currentPOI?: EntityId<'poi'>;         // Wenn gesetzt: NPC ist an diesem POI
                                         // Wenn nicht: Faction-Territory-Logik

  // === GM-Notizen ===
  gmNotes?: string;
}

interface PersonalityTraits {
  primary: string;                      // "misstrauisch" | "neugierig" | ...
  secondary: string;                    // "gierig" | "loyal" | ...
}

interface CreatureRef {
  type: string;                         // Kreatur-Typ (z.B. "goblin")
  id: EntityId<'creature'>;             // Verweis auf Creature-Template
}
```

**Was NICHT im NPC-Schema ist:**
- `partyKnowledge` - GM trackt das in Notizen oder Journal-Entries
- `relationToParty` - Kreative GM-Entscheidung
- `encounters[]` - Historie via Journal-Entries im WorldEvents-Feature (mit NPC-Verlinkung)
- `statOverrides` - Post-MVP Feature (nutzt Creature-Editor UI)
- `homeLocation` - Post-MVP (zusammen mit Routen/Schedules)
- `cultureId` - Kultur ist direkt in der Faction eingebettet (via Faction-Hierarchie)

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

→ Generierungsdetails: [NPC-Generierung](#npc-generierung)

---

## NPC-Location via Fraktionen

NPCs haben **keine explizite Location**. Stattdessen wird ihre moegliche Praesenz ueber Fraktionen bestimmt:

```
NPC → gehoert zu Fraktion → Fraktion hat Presence auf Tiles → NPC kann dort erscheinen
```

### MVP: Fraktions-basierte Location

```typescript
// NPC ist IMMER Teil einer Fraktion (required)
interface NPC {
  factionId: EntityId<'faction'>;
  // ...
}

// Fraktion hat Territory via kontrollierte POIs
interface Faction {
  controlledPOIs: EntityId<'poi'>[];  // POIs die von Faction kontrolliert werden
  // Praesenz wird aus POIs + Staerke berechnet
}

// Bei Encounter-Generierung: Welche NPCs koennen hier erscheinen?
function findEligibleNPCs(tile: HexCoordinate): NPC[] {
  const factionsAtTile = getFactionsByPresence(tile);
  return npcs.filter(npc =>
    factionsAtTile.some(f => f.id === npc.factionId)
  );
}
```

**Hinweis:** `factionId` ist optional. Fraktionslose NPCs (wilde Tiere, Einsiedler) nutzen Creature-Tags als Fallback fuer die Generierung.

### MVP (niedrige Prio): Explizite NPC-Location

Optional kann der GM einen NPC an einem spezifischen POI platzieren:

```typescript
interface NPC {
  // ...
  currentPOI?: EntityId<'poi'>;       // GM setzt expliziten Aufenthaltsort
}

// Encounter-Logik mit expliziter Location:
function findNPCsAtTile(tile: HexCoordinate): NPC[] {
  // 1. NPCs mit expliziter Location an diesem Tile
  const explicitNPCs = npcs.filter(npc =>
    npc.currentPOI && getPOITile(npc.currentPOI) === tile
  );

  // 2. NPCs via Faction-Territory (ohne explizite Location)
  const factionNPCs = npcs.filter(npc =>
    !npc.currentPOI && factionHasPresenceAt(npc.factionId, tile)
  );

  return [...explicitNPCs, ...factionNPCs];
}
```

**Semantik:** Wenn `currentPOI` gesetzt ist, ist der NPC definitiv dort. Ohne explizite Location greift die Faction-Territory-Logik.

### Post-MVP: Erweiterte Location-Features

| Feature | Beschreibung | Prioritaet |
|---------|--------------|------------|
| **Stat-Overrides** | Vollstaendige Stat-Anpassungen, UI vom Creature-Editor | Hoch |
| NPC-Routen | Wandernde NPCs (Haendler, Patrouillen) mit definierten Routen | Mittel |
| NPC-Schedules | Tagesablauf-basierte Location (Morgens im Laden, Abends in Taverne) | Mittel |
| `homeLocation` | NPC hat Heimat-Tile mit Radius-Bonus fuer Erscheinen | Niedrig |
| Faction-lose NPCs | Einsiedler, Wanderer ohne Faction | Niedrig |
| NPC-Agency | NPCs bewegen sich zur Runtime selbststaendig | Fernziel |

**Wichtig:** Fuer MVP genuegt die Fraktions-basierte Location + optionale explizite POI-Platzierung. Erweiterte Features koennen spaeter hinzugefuegt werden, ohne das Schema zu brechen.

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

### Goal-Pool-Hierarchie

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

### Quirk-Einzigartigkeit

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

## NPC-Detail-Stufen

Bei Encounters werden NPCs mit unterschiedlicher Detailtiefe generiert:

### Drei Stufen

| Stufe | Details | Persistierung | Max pro Encounter |
|-------|---------|---------------|-------------------|
| **Lead-NPC** | Name, Personality (2 Traits), Quirk, Goal | Ja (EntityRegistry) | 1 pro Gruppe |
| **Highlight-NPC** | Name, Personality (1 Trait) | Nein (session-only) | 1 pro Gruppe, max 3 gesamt |
| **Anonym** | Nur Kreatur-Typ + Anzahl | Nein | Unbegrenzt |

### PartialNPC Schema (Highlight-NPCs)

```typescript
interface PartialNPC {
  name: string;
  primaryTrait: string;       // Nur ein Personality-Trait
  creatureType: string;       // Kreatur-Typ fuer Anzeige
}
```

**Verwendung:** Highlight-NPCs geben Gruppen mehr Persoenlichkeit, ohne die NPC-Datenbank aufzublaehen. Sie werden nicht persistiert und existieren nur fuer die Dauer des Encounters.

### Beispiel

```
Goblin-Patrouille (5 Goblins):
├── Lead: Griknak der Hinkende (misstrauisch, gierig) - "will Boss beeindrucken"
├── Highlight: Snaggle (nervoes)
└── Anonym: Goblin-Krieger ×3
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

**Wichtig - NPC-Limits bei Multi-Gruppen:**

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

→ Details: [encounter/Encounter.md](../features/encounter/Encounter.md#multi-group-encounters)

---

## GM-Interface

### Encounter-Preview

Bei der Encounter-Vorschau sieht der GM:

```
┌─────────────────────────────────────────────────────────┐
│  Encounter: Goblin-Patrouille                           │
├─────────────────────────────────────────────────────────┤
│  Lead NPC: Griknak der Hinkende                         │
│  ★ Wiederkehrender NPC (2 vorherige Begegnungen)        │
│                                                         │
│  Persoenlichkeit: misstrauisch, gierig                  │
│  Ziel: Boss beeindrucken                                │
│  Quirk: Hinkt auf dem linken Bein                       │
│                                                         │
│  Letzte Begegnung: Vor 5 Tagen                          │
├─────────────────────────────────────────────────────────┤
│  [Start] [Anderen NPC waehlen] [Neu generieren]         │
└─────────────────────────────────────────────────────────┘
```

### NPC-Bearbeitung (Library)

NPCs koennen in der Library bearbeitet werden:
- Name, Persoenlichkeit, Quirk anpassen
- Status auf `dead` setzen
- GM-Notizen hinzufuegen

---

## Prioritaet

| Komponente | Prioritaet | MVP |
|------------|------------|-----|
| NPC-Generierung | Hoch | Ja |
| NPC-Persistierung | Hoch | Ja |
| Existierende NPC-Auswahl | Mittel | Einfacher Match |
| NPC-Status-Tracking | Mittel | Nur alive/dead |

---

*Siehe auch: [Faction.md](Faction.md) | [Character-System.md](../features/Character-System.md) | [encounter/Balance.md](../features/encounter/Balance.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 1300 | ⛔ | NPC | core | NPC-Schema Interface: id, name, creature, factionId, personality, status | hoch | Ja | #1400, #2703 | NPC-System.md#npc-schema, EntityRegistry.md#creature-hierarchie-definition-vs-instanz-vs-npc, Core.md#branded-types | src/core/schemas/npc.ts:52-103 |
| 1301 | ⛔ | NPC | core | PersonalityTraits Interface: primary + secondary Traits | hoch | Ja | #1300 | NPC-System.md#npc-schema | src/core/schemas/npc.ts:22-28 |
| 1302 | ⛔ | NPC | core | CreatureRef Interface: type + id Verweis auf Creature-Template | hoch | Ja | #1200, #1300 | NPC-System.md#npc-schema, Creature.md#schema, EntityRegistry.md#creature-hierarchie-definition-vs-instanz-vs-npc | src/core/schemas/creature.ts:222-230 (creatureRefSchema) |
| 1303 | ⛔ | NPC | core | NPC Tracking-Felder: firstEncounter, lastEncounter, encounterCount | hoch | Ja | #1300 | NPC-System.md#npc-schema, NPC-System.md#npc-lifecycle | src/core/schemas/npc.ts:85-92 |
| 1304 | ⛔ | NPC | core | NPC Status-Enum: alive, dead (Vereinfacht für MVP) | hoch | Ja | #1300 | NPC-System.md#npc-schema, NPC-System.md#status-uebergaenge | src/core/schemas/npc.ts:40-42 |
| 1305 | ⛔ | NPC | core | Optional currentPOI-Feld: Explizite NPC-Platzierung | mittel | Nein | #1300, #1500 | NPC-System.md#mvp-niedrige-prio-explizite-npc-location, POI.md#schema | src/core/schemas/npc.ts:97 |
| 1306 | ⛔ | NPC | core | NPCMatchCriteria Interface: creatureType + factionId | hoch | Ja | #1300, #1400 | NPC-System.md#match-kriterien, Creature.md#schema, Faction.md#schema | src/core/schemas/npc.ts:114-120 (im Schema statt types.ts) |
| 1307 | ✅ | NPC | features | findMatchingNPC(): Suche existierende NPCs nach Kriterien | hoch | Ja | #1306, #2800, #2804 | NPC-System.md#match-kriterien, NPC-System.md#npc-auswahl-algorithmus, EntityRegistry.md#querying | Integriert in selectOrGenerateNpc (src/features/encounter/npc-generator.ts:320-353) |
| 1308 | ⛔ | NPC | features | calculateMatchScore(): Scoring-System (Wiedersehen +15, kürzlich -30) | hoch | Ja | #1303, #1307 | NPC-System.md#match-kriterien, NPC-System.md#npc-auswahl-algorithmus, NPC-System.md#npc-lifecycle | src/features/encounter/npc-generator.ts:277-301 (calculateNpcMatchScore) |
| 1309 | 🔶 | NPC | features | resolveFactionCulture(): Kultur aus Faction-Hierarchie auflösen | hoch | Ja | #1400, #1401, #1405 | NPC-System.md#npc-generierung, Faction.md#kultur-vererbung, Faction.md#hierarchie | src/features/encounter/npc-generator.ts:37-63 |
| 1310 | ✅ | NPC | features | generateNameFromCulture(): Namen aus Kultur-Daten generieren | hoch | Ja | #1309, #1401 | NPC-System.md#npc-generierung, Faction.md#kultur-vererbung, Faction.md#naming | src/features/encounter/npc-generator.ts:127-167 (generateNpcName) |
| 1311 | ✅ | NPC | features | rollPersonalityFromCulture(): Persönlichkeits-Traits würfeln | hoch | Ja | #1309, #1401 | NPC-System.md#npc-generierung, Faction.md#kultur-vererbung, Faction.md#personality | src/features/encounter/npc-generator.ts:200-224 (generatePersonality) |
| 1312 | 🔶 | NPC | features | rollQuirkFromCulture(): Quirk generieren mit Kreatur-Kompatibilitäts-Filter (canSpeak, socialCreature) und Einzigartigkeit-Tracking (100% Coverage) | mittel | Ja | #1309, #1401 | NPC-System.md#npc-generierung, NPC-System.md#quirk-einzigartigkeit, Faction.md#quirk-wuerfeln | src/features/encounter/npc-generator.ts:230-249 (rollQuirkFromCulture) |
| 1313 | 🟢 | NPC | features | selectPersonalGoal(): Goal mit Pool-Hierarchie (Generisch → Creature → Fraktion) und Persönlichkeits-Gewichtung | mittel | Ja | #1311, #1401, #3240 | NPC-System.md#goal-pool-hierarchie, Creature.md#schema, Faction.md#culture-schema | src/features/encounter/npc-generator.ts:254-267 (generatePersonalGoal) |
| 1314 | ⛔ | NPC | features | generateNewNPC(): Haupt-Generierungs-Funktion mit Persistierung | hoch | Ja | #1300, #1310, #1311, #1312, #1313, #2800, #2802, #3172 | NPC-System.md#npc-generierung, NPC-System.md#npc-schema, EntityRegistry.md#port-interface | src/features/encounter/npc-generator.ts:358-385 (generateNewNpc) |
| 1315 | ⛔ | NPC | core | EntityRegistry Integration: NPC als Entity-Typ registrieren | hoch | Ja | #1300, #2800, #2801 | NPC-System.md#npc-generierung, EntityRegistry.md#entity-type-mapping, EntityRegistry.md#storage | src/core/schemas/common.ts:45 (EntityType enum) |
| 1316 | ⛔ | NPC | features | updateNPCAfterEncounter(): Tracking-Felder aktualisieren (lastEncounter, encounterCount) und Status-Transition (dead bei npcKilled) | hoch | Ja | #214, #1303, #1304, #2800 | NPC-System.md#encounter-nachbereitung, NPC-System.md#status-uebergaenge, encounter/Encounter.md#encounter-outcome | [neu] src/features/npc/npc-service.ts:updateNpcAfterEncounter() |
| 1318 | ✅ | NPC | features | selectOrGenerateLeadNPC(): Integration mit Encounter-System | hoch | Ja | #1200, #1307, #1314 | NPC-System.md#lead-npc-auswahl, NPC-System.md#integration-mit-encounters, encounter/Encounter.md#npc-instanziierung | src/features/encounter/npc-generator.ts:320-353 (selectOrGenerateNpc), verwendet in encounter-service.ts:513-521 |
| 1319 | ⛔ | NPC | features | resolveMultiGroupNPCs(): Lead + Highlight NPCs pro Gruppe (max 3 Highlights GLOBAL) | hoch | Ja | #252, #1318, #2972, #2973 | NPC-System.md#multi-gruppen-encounters, encounter/Encounter.md#npc-instanziierung, encounter/Encounter.md#multi-group-encounters | [neu] src/features/encounter/npc-generator.ts:resolveMultiGroupNPCs() |
| 1320 | ⛔ | NPC | features | findEligibleNPCs(): NPCs nach Faction-Territory filtern (Faction.controlledPOIs → Tile-Präsenz) | hoch | Ja | #1400, #1409, #1410, #2804 | NPC-System.md#mvp-fraktions-basierte-location, Faction.md#territory-via-pois, Faction.md#encounter-integration | [neu] src/features/npc/npc-location.ts:findEligibleNpcs() |
| 1321 | ⛔ | NPC | features | findNPCsAtTile(): Kombination explizite Location (currentPOI) + Faction-Territory-Logik | mittel | Nein | #1305, #1320, #1500 | NPC-System.md#mvp-niedrige-prio-explizite-npc-location, NPC-System.md#mvp-fraktions-basierte-location, POI.md#schema | [neu] src/features/npc/npc-location.ts:findNpcsAtTile() |
| 1322 | ⛔ | NPC | application | NPC Library-View: CRUD-Interface für NPC-Bearbeitung | mittel | Ja | #1300, #2800, #2802 | NPC-System.md#npc-bearbeitung-library, NPC-System.md#gm-interface, Library.md#entity-views | [neu] src/application/views/library/NPCView.svelte |
| 1323 | ⬜ | NPC | application | Lead-NPC UI-Sektion: Persönlichkeit, Quirk, Ziel, Wiederkehr-Indikator, Encounter-History, Re-Roll-Buttons ([Anderen NPC wählen] [Neu generieren]) | mittel | Ja | #1318, #2409, #2415 | NPC-System.md#encounter-preview, NPC-System.md#gm-interface, encounter/Encounter.md#encounter-ui | [neu] src/application/components/encounter/EncounterPreview.svelte |
| 2972 | ⛔ | NPC | core | PartialNPC/HighlightNPC Schema (Name + primaryTrait, session-only) | hoch | Ja | #1300 | NPC-System.md#npc-detail-stufen | [neu] src/core/schemas/npc.ts:partialNpcSchema |
| 2973 | ⛔ | NPC | features | generateHighlightNPC(): Oberflächliche NPC-Generierung (Name + 1 Trait) | hoch | Ja | #2972 | NPC-System.md#npc-detail-stufen | [neu] src/features/encounter/npc-generator.ts:generateHighlightNpc() |
| 2975 | ⛔ | NPC | features | buildCultureFromCreatureTags(): Fallback-Kultur-Generierung für fraktionslose Creatures (Beast/Predator-Tags → Naming/Personality) | mittel | Ja | #2978, #1314, #3245, #3246 | NPC-System.md#npc-generierung, Creature.md#tags | [neu] src/features/encounter/npc-generator.ts:buildCultureFromCreatureTags() |
| 2978 | ⛔ | NPC | core | NPC-Schema: factionId von required auf optional ändern (Fallback auf Creature-Tags für fraktionslose NPCs) | hoch | Ja | #1300 | NPC-System.md#npc-schema, NPC-System.md#npc-generierung | - |
| 3172 | ⬜ | NPC | features | resolveCultureForNPC(): Wrapper-Funktion - nutzt resolveFactionCulture() wenn Faction vorhanden, sonst buildCultureFromCreatureTags() | mittel | -d | - | NPC-System.md#npc-generierung | - |
| 3240 | ⬜ | NPC | features | GENERIC_GOALS Konstante: Basis-Goal-Pool für alle Kreaturen (survive, explore, find_food, etc.) | hoch | --spec | - | - | - |
| 3248 | ⬜ | NPC | features | usedQuirks Session-Tracking: Set<string> zur Vermeidung von Quirk-Wiederholungen innerhalb einer Session | mittel | -d | - | NPC-System.md#quirk-einzigartigkeit | - |
