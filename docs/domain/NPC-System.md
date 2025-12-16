# NPC-System

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
  factionId: EntityId<'faction'>;       // Jeder NPC gehoert zu einer Faction

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

**Wichtig:** Jeder NPC muss einer Faction angehoeren. Faction-lose NPCs (Einsiedler, Wanderer) sind Post-MVP.

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
  context: EncounterContext
): NPC {
  // Faction holen (required)
  const faction = entityRegistry.get('faction', creature.factionId);

  // Kultur aus Faction-Hierarchie aufloesen
  const culture = resolveFactionCulture(faction);

  // Name generieren aus Kultur
  const name = generateNameFromCulture(culture);

  // Persoenlichkeit wuerfeln
  const personality = rollPersonalityFromCulture(culture);

  // Quirk (30% Chance)
  const quirk = Math.random() < 0.3
    ? rollQuirkFromCulture(culture)
    : undefined;

  // Persoenliches Ziel basierend auf Kreatur und Kontext
  const personalGoal = selectPersonalGoal(creature, context);

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

// Kultur-Aufloesung aus Faction-Hierarchie (siehe Faction.md)
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
  npc.lastEncounter = encounter.timestamp;
  npc.encounterCount++;

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

Bei Multi-Gruppen-Encounters wird fuer jede Gruppe ein Lead-NPC bestimmt:

```typescript
function resolveMultiGroupNPCs(
  encounter: MultiGroupEncounter,
  context: EncounterContext
): MultiGroupEncounter {
  for (const group of encounter.groups) {
    group.leadNPC = selectOrGenerateLeadNPC(
      group.creatures[0],
      context
    );
  }
  return encounter;
}
```

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

*Siehe auch: [Faction.md](Faction.md) | [Character-System.md](../features/Character-System.md) | [Encounter-Balancing.md](../features/Encounter-Balancing.md)*
