# Encounter-Feature

Unified Entry-Point fuer Encounter-Generierung, Typen und Balancing.

**Design-Philosophie:** Die Spielwelt existiert unabhaengig von der Party. Kreaturen werden basierend auf Tile-Eligibility ausgewaehlt, der Encounter-Typ ergibt sich aus der Beziehung zur Party. CR-Balancing gilt nur fuer Combat.

---

## Uebersicht

Das Encounter-Feature verwaltet:

1. **Generierung** - Kreatur-zentrierter Algorithmus fuer Zufallsbegegnungen
2. **Typen** - 4 MVP-Encounter-Typen (combat, social, passing, trace) + 2 post-MVP (environmental, location)
3. **Balancing** - XP-Budget fuer Combat, CR-unabhaengig fuer andere Typen
4. **NPC-Instanziierung** - Wann werden NPCs erstellt und persistiert

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Tile-Eligibility (Filter)                                   │
│     Terrain + Tageszeit → Welche Kreaturen KOENNEN erscheinen?  │
├─────────────────────────────────────────────────────────────────┤
│  2. Kreatur-Auswahl (Gewichtung)                                │
│     Fraktion + Raritaet + Wetter → Gewichtete Zufallsauswahl    │
│     KEIN CR-Filter - die Welt ist Party-Level-agnostisch        │
├─────────────────────────────────────────────────────────────────┤
│  3. Typ-Ableitung (Deterministisch)                             │
│     Disposition + Faction-Relation + CR-Balancing → Typ         │
├─────────────────────────────────────────────────────────────────┤
│  4. Variety-Validation (Separater Schritt)                      │
│     Bei Monotonie: dynamische Typ-Anpassung                     │
├─────────────────────────────────────────────────────────────────┤
│  5. Encounter-Befuellung                                        │
│     Typ-spezifische Details, Anzahlen, NPC-Instanziierung       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Encounter-Typen

| Typ | Beschreibung | CR-relevant? | Beispiel |
|-----|--------------|--------------|----------|
| `combat` | Kampfbegegnung mit Kreaturen | **Ja** | Goblin-Hinterhalt |
| `social` | Interaktion mit NPCs | Nein | Reisender Haendler |
| `passing` | Etwas passiert in der Naehe | Nein | Drache fliegt am Horizont |
| `trace` | Hinweise auf vergangene Ereignisse | Nein | Verlassenes Lager |
| `environmental` | Umwelt-Herausforderung (post-MVP) | Nein | Steinschlag |
| `location` | Entdeckung eines Ortes (post-MVP) | Nein | Hoehleneingang |

→ Detaillierte Typen-Dokumentation: [Encounter-Types.md](Encounter-Types.md)
→ Balancing-Algorithmus: [Encounter-Balancing.md](Encounter-Balancing.md)

---

## Creature Selection

Die Kreatur-Auswahl erfolgt in zwei Phasen:

### Phase 1: Filter (Hard Requirements)

Kreaturen werden **ausgeschlossen** wenn:

| Filter | Pruefung |
|--------|----------|
| **Terrain** | `Kreatur.terrainAffinities` enthaelt aktuelles Terrain? |
| **Tageszeit** | `Kreatur.activeTime` enthaelt aktuelle Tageszeit? |

Ein Fisch kann nicht im Berg erscheinen. Ein nachtaktiver Vampir erscheint nicht mittags.

### Phase 2: Gewichtung (Soft Factors)

Verbleibende Kreaturen erhalten Gewichtungen:

| Faktor | Gewichtung |
|--------|------------|
| **Fraktionspraesenz** | Fraktion kontrolliert Tile? → ×2.0 bis ×5.0 |
| **Raritaet** | common: ×1.0, uncommon: ×0.3, rare: ×0.05 |
| **Wetter** | `Kreatur.preferredWeather` matched? → ×1.5 |

### Minimum-Schwelle

Kreaturen mit Gesamt-Gewicht unter der Minimum-Schwelle werden ausgeschlossen. Dies verhindert "technisch moeglich aber absurd"-Ergebnisse.

### Kein CR-Filter

**Wichtig:** CR beeinflusst die Kreatur-Auswahl NICHT. Die Welt existiert unabhaengig von der Party. Ein Drache in der Gegend kann erscheinen - das CR bestimmt nur den Encounter-Typ (passing statt combat wenn nicht gewinnbar).

---

## Typ-Ableitung

Der Encounter-Typ wird **deterministisch** aus drei Faktoren abgeleitet:

### Faktoren

| Faktor | Beschreibung | Einfluss |
|--------|--------------|----------|
| **Kreatur-Disposition** | `hostile`, `neutral`, `friendly` am Statblock | Basis-Gewichtung |
| **Faction-Relation** | Beziehung der Kreatur-Fraktion zur Party | Modifikator |
| **CR-Balancing** | Kann die Party diesen Kampf gewinnen? | Sicherheitsventil |

### Wahrscheinlichkeits-Matrix

| Disposition | Faction | Winnable | → combat | → social | → passing | → trace |
|-------------|---------|----------|----------|----------|-----------|---------|
| hostile | hostile | ja | 80% | 5% | 10% | 5% |
| hostile | hostile | nein | 5% | 5% | 70% | 20% |
| hostile | neutral | ja | 60% | 10% | 20% | 10% |
| neutral | any | - | 10% | 50% | 25% | 15% |
| friendly | friendly | - | 0% | 70% | 20% | 10% |

### Variety-Validation

Nach der Typ-Ableitung erfolgt **Variety-Validation** als separater Schritt (Schritt 4). Dieses System verhindert Monotonie durch dynamische Typ-Anpassung wenn ein Typ ueberrepraesentiert ist.

→ Details: [Encounter-Balancing.md](Encounter-Balancing.md#variety-validation)

### Backend-Only

**Wichtig:** Der Typ ist eine interne Generierungs-Kategorie. Der GM erhaelt immer dieselben Informationen:
- Kreaturen mit Stats
- Disposition und Ziele
- NPC-Details (Name, Persoenlichkeit)
- Aktivitaet und Kontext

Der GM leitet den Encounter frei - ein "combat"-Encounter kann friedlich enden, ein "social"-Encounter kann eskalieren.

---

## NPC-Instanziierung

### Wann werden NPCs erstellt?

NPCs werden **bei Encounter-Instanziierung** erstellt, nicht bei Definition:

| Zeitpunkt | Aktion |
|-----------|--------|
| EncounterDefinition erstellt | Keine NPC-Erstellung (nur Slots) |
| Encounter getriggert | NPC-Instanziierung |
| Encounter angezeigt | NPC bereits verfuegbar |

### Instanziierungs-Flow

```typescript
// 1. Encounter-Definition hat CreatureSlots (keine konkreten NPCs)
const definition: EncounterDefinition = {
  creatureSlots: [
    { slotType: 'typed', creatureId: 'goblin', count: { min: 3, max: 5 } }
  ]
};

// 2. Bei Trigger: Slots werden aufgeloest → NPCs instanziiert
function instantiateEncounter(
  definition: EncounterDefinition,
  context: EncounterContext
): EncounterInstance {
  const npcs: NPC[] = [];

  for (const slot of definition.creatureSlots) {
    // Slot aufloesen → konkrete Kreaturen
    const creatures = resolveCreatureSlot(slot, context);

    for (const creature of creatures) {
      // NPC-Auswahl: Existierend oder neu
      const npc = selectOrGenerateNPC(creature, context);
      npcs.push(npc);
    }
  }

  return { definitionId: definition.id, npcs, /* ... */ };
}
```

### NPC-Auswahl vs Generierung

```typescript
function selectOrGenerateNPC(
  creature: CreatureDefinition,
  context: EncounterContext
): NPC {
  // 1. Suche passenden existierenden NPC
  const existingNPC = findMatchingNPC({
    creatureType: creature.type,
    factionId: creature.factionId,
    status: 'alive'
  }, context);

  if (existingNPC) {
    // 2a. Existierender NPC gefunden → Update Tracking
    existingNPC.lastEncounter = context.currentTime;
    existingNPC.encounterCount++;
    entityRegistry.save('npc', existingNPC);
    return existingNPC;
  }

  // 2b. Kein passender NPC → Neu generieren + persistieren
  const newNPC = generateNewNPC(creature, context);
  entityRegistry.save('npc', newNPC);  // WICHTIG: Sofort persistieren!
  return newNPC;
}
```

### Persistierungs-Regeln

| NPC-Typ | Persistierung | Grund |
|---------|---------------|-------|
| Lead-NPC eines Encounters | **Immer** | Wiedererkennung ermoeglichen |
| Begleiter-NPCs | **Bei Namen** | Wenn GM Namen gibt oder Beziehung entsteht |
| Generische Gegner | **Nein** | "3 Goblins" bleiben anonym |

```typescript
// Lead-NPC wird immer persistiert
const leadNPC = selectOrGenerateNPC(leadCreature, context);
entityRegistry.save('npc', leadNPC);

// Begleiter nur bei Namensgebung
const companion = createCompanion(creature);
// companion wird NICHT automatisch persistiert
// Erst wenn GM ihn benennt oder er wichtig wird
```

### Wiedererkennung

Das System bevorzugt existierende NPCs fuer Konsistenz:

```typescript
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
  return scored[0]?.score > MATCH_THRESHOLD ? scored[0].npc : null;
}

function calculateMatchScore(npc: NPC, context: EncounterContext): number {
  let score = 10;  // Basis-Score fuer existierenden NPC

  // Wiedersehen ist interessanter
  if (npc.encounterCount > 0) score += 15;

  // Kuerzlich getroffen = weniger wahrscheinlich (Abwechslung)
  const daysSinceLastEncounter = getDaysSince(npc.lastEncounter, context.currentTime);
  if (daysSinceLastEncounter < 3) score -= 30;
  if (daysSinceLastEncounter > 30) score += 10;

  return score;
}
```

→ Vollstaendige NPC-Dokumentation: [NPC-System.md](../domain/NPC-System.md)

---

## Schemas

### CreatureDefinition vs Creature vs NPC

Drei-stufige Trennung fuer Klarheit:

| Begriff | Bedeutung | Persistenz | Beispiel |
|---------|-----------|------------|----------|
| `CreatureDefinition` | Template/Statblock | EntityRegistry | "Goblin", CR 1/4, 7 HP |
| `Creature` | Instanz in Encounter | **Runtime** | "Goblin #1", aktuell 5 HP |
| `NPC` | Benannte persistente Instanz | EntityRegistry | "Griknak", Persoenlichkeit |

```typescript
// Template (EntityRegistry)
interface CreatureDefinition {
  id: EntityId<'creature'>;
  name: string;           // "Goblin"
  cr: number;
  maxHp: number;
  ac: number;
  // ... Statblock
}

// Instanz (Runtime, innerhalb Encounter)
interface Creature {
  definitionId: EntityId<'creature'>;
  currentHp: number;
  conditions: Condition[];
}

// Benannte persistente Instanz (EntityRegistry)
interface NPC {
  id: EntityId<'npc'>;
  creature: CreatureRef;              // Referenz auf Statblock (mit type fuer Matching)
  name: string;
  personality: PersonalityTraits;
  factionId: EntityId<'faction'>;     // Required
  status: 'alive' | 'dead';
  currentPOI?: EntityId<'poi'>;       // Optional: Expliziter Aufenthaltsort
  // Tracking
  firstEncounter: GameDateTime;
  lastEncounter: GameDateTime;
  encounterCount: number;
}

interface CreatureRef {
  type: string;                       // Kreatur-Typ fuer NPC-Matching
  id: EntityId<'creature'>;           // Verweis auf Creature-Template
}
```

### EncounterDefinition

```typescript
interface EncounterDefinition {
  id: EntityId<'encounter'>;
  name: string;
  type: EncounterType;

  // Flexible Kreatur-Slots (nicht konkrete NPCs!)
  creatureSlots: CreatureSlot[];

  // Kontext
  activity?: string;
  goal?: string;

  // Trigger-Bedingungen
  triggers?: EncounterTriggers;

  // Rewards
  xpReward?: number;
  loot?: LootTableRef | LootEntry[];

  // Flags
  isUnique?: boolean;
  requiresQuestAssignment?: boolean;
}
```

### EncounterInstance

```typescript
interface EncounterInstance {
  definitionId: EntityId<'encounter'>;
  type: EncounterType;

  // Aufgeloeste NPCs (instanziiert bei Trigger)
  npcs: NPC[];
  leadNPC: NPC;

  // Kontext
  activity: string;
  goal: string;

  // Runtime-State
  status: 'pending' | 'active' | 'resolved';
  outcome?: EncounterOutcome;
}
```

---

## State-Machine

```
pending → active → resolved
            ↓
        (combat) → Combat-Feature uebernimmt
```

### Status-Uebergaenge

| Trigger | Von | Nach |
|---------|-----|------|
| Encounter generiert | - | `pending` |
| GM zeigt Encounter an | `pending` | `active` |
| `combat`: Combat gestartet | `active` | (Combat-Feature) |
| GM markiert als beendet | `active` | `resolved` |
| Combat beendet | (Combat-Feature) | `resolved` |

---

## Events

```typescript
// Requests
'encounter:generate-requested': {
  trigger: 'time-based' | 'manual' | 'location';
  context: EncounterContext;
}
'encounter:start-requested': { encounterId: string }
'encounter:dismiss-requested': { encounterId: string; reason?: string }
'encounter:resolve-requested': { encounterId: string; outcome: EncounterOutcome }

// State-Changes
'encounter:state-changed': { state: EncounterState }

// Lifecycle
'encounter:generated': { encounter: EncounterInstance }
'encounter:started': { encounterId: string; type: EncounterType; encounter: EncounterInstance }
'encounter:dismissed': { encounterId: string; reason?: string }
'encounter:resolved': { encounterId: string; outcome: EncounterOutcome; xpAwarded: number; loot?: LootResult }

// Combat-Eskalation (nur fuer combat-Typ)
'combat:start-requested': { encounterId: string; participants: CombatParticipant[] }
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Integration mit anderen Features

### Encounter + Travel

Travel-Feature triggert Encounter-Checks **1x pro Stunde**:

```
time:hour-passed → Encounter-Check (12.5% Basis-Chance) → encounter:generate-requested
```

→ Details: [Travel-System.md](Travel-System.md#encounter-checks-waehrend-reisen)

### Encounter + Combat

Bei `combat`-Typ wird Combat-Feature aktiviert:

```
encounter:started (type: combat) → combat:start-requested
```

### Encounter + Loot

Nach Combat-Aufloesung wird Loot generiert:

```
combat:ended → loot:generate-requested
```

### Encounter + Quest

Encounters koennen Quest-Objectives triggern:

```
encounter:resolved → quest:objective-check
```

---

## XP-System und Quest-Integration

### 40/60 XP Split (MVP High Priority)

**Alle Combat-Encounters geben XP nach folgendem Schema:**

| XP-Anteil | Wann | Empfaenger |
|-----------|------|------------|
| **40%** | Sofort bei Encounter-Ende | Party direkt |
| **60%** | Bei Quest-Abschluss | Quest-Reward-Pool |

```typescript
function distributeEncounterXP(
  encounter: EncounterInstance,
  isQuestRelated: boolean
): void {
  const totalXP = encounter.xpReward;
  const immediateXP = Math.floor(totalXP * 0.4);
  const questXP = totalXP - immediateXP;

  // 40% sofort an Party
  eventBus.publish('party:xp-gained', { amount: immediateXP, source: encounter.id });

  // 60% in Quest-Pool (falls Quest-Encounter)
  if (isQuestRelated && encounter.questId) {
    eventBus.publish('quest:xp-accumulated', {
      questId: encounter.questId,
      amount: questXP
    });
  } else {
    // Kein Quest → 60% verfallen NICHT, gehen auch an Party
    eventBus.publish('party:xp-gained', { amount: questXP, source: encounter.id });
  }
}
```

**Wichtig:** Der 40/60 Split ist ein festes MVP-Feature und non-negotiable. Konfigurierbare Prozentsaetze sind Post-MVP.

→ Quest-Integration: [Quest-System.md](Quest-System.md)

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Creature Selection (Filter) | ✓ | | Terrain + Tageszeit |
| Creature Selection (Gewichtung) | ✓ | | Fraktion + Raritaet + Wetter |
| Typ-Ableitung | ✓ | | Disposition + Faction + CR |
| Variety-Validation | ✓ | | Monotonie-Vermeidung (separater Schritt) |
| Combat-Encounter | ✓ | | Kern-Typ |
| Social-Encounter | ✓ | | NPC-Integration |
| Passing/Trace | ✓ | | Mit Kreaturen |
| NPC-Instanziierung | ✓ | | Bei Trigger, nicht Definition |
| NPC-Persistierung | ✓ | | Lead-NPCs immer |
| 40/60 XP Split | ✓ | | Non-negotiable |
| Environmental/Location | | ✓ | Ohne Kreaturen |
| Multi-Gruppen | | niedrig | Komplexe Szenarien |

---

*Siehe auch: [Encounter-Types.md](Encounter-Types.md) | [Encounter-Balancing.md](Encounter-Balancing.md) | [NPC-System.md](../domain/NPC-System.md) | [Combat-System.md](Combat-System.md) | [Quest-System.md](Quest-System.md)*
