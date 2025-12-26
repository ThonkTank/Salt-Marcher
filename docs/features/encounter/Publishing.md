# Encounter-Publishing

> **Zurueck zu:** [Encounter](Encounter.md)
> **Empfaengt von:** [Adjustments](Adjustments.md) - `BalancedEncounter`
> **Siehe auch:** [Initiation](Initiation.md), [Difficulty](Difficulty.md), [Combat-System](../Combat-System.md)

Was das Encounter-System produziert und fuer andere Systeme bereitstellt.

**Verantwortlichkeit:** Step 7 der 7-Step-Pipeline
- EncounterInstance erstellen
- `encounter:generated` Event publizieren (sticky)
- GM sieht Preview und entscheidet: Start / Dismiss / Regenerate

---

## State-Machine

```
pending → active → resolved
            ↓
        (combat) → Combat-Feature uebernimmt
```

| Trigger | Von | Nach |
|---------|-----|------|
| Encounter generiert | - | `pending` |
| GM zeigt Encounter an | `pending` | `active` |
| Niedriger survivabilityFactor + hostile: Combat gestartet | `active` | (Combat-Feature) |
| GM markiert als beendet | `active` | `resolved` |

---

## Lifecycle-Events

### Request-Events

```typescript
'encounter:start-requested': {
  encounterId: string;
}

'encounter:dismiss-requested': {
  encounterId: string;
  reason?: string;
}

'encounter:resolve-requested': {
  encounterId: string;
  outcome: EncounterOutcome;
}
```

### Lifecycle-Events

```typescript
'encounter:generated': {
  encounter: EncounterInstance;
}

'encounter:started': {
  encounterId: string;
  survivabilityFactor: number;
}

'encounter:dismissed': {
  encounterId: string;
}

'encounter:resolved': {
  encounterId: string;
  outcome: EncounterOutcome;
  xpAwarded: number;
}
```

### State-Sync

```typescript
'encounter:state-changed': {
  currentEncounter: EncounterInstance | null;
}
```

### Sticky-Events

| Event | Sticky | Cleared by |
|-------|:------:|------------|
| `encounter:generated` | Ja | `encounter:started`, `encounter:dismissed` |

Der GM sieht das Encounter im Preview und entscheidet: Start / Dismiss / Regenerate.

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../../architecture/Events-Catalog.md)

---

## Output-Schemas

### EncounterInstance

EncounterInstance **erweitert** BalancedEncounter und fuegt Publishing-spezifische Felder hinzu.
Die groups[]-Struktur bleibt erhalten (Multi-Group-Support).

```typescript
interface EncounterInstance extends BalancedEncounter {
  // === Instance-spezifische Felder ===
  id: string;
  state: 'pending' | 'active' | 'resolved';
  description: string;  // GM-taugliche Beschreibung

  // === Trace-relevante Felder (bei trivial Difficulty) ===
  traceAge?: 'fresh' | 'recent' | 'old';
  trackingDC?: number;

  // === Timing & Resolution ===
  generatedAt: GameDateTime;
  resolvedAt?: GameDateTime;
  outcome?: EncounterOutcome;
  xpAwarded?: number;
}

// Geerbt von BalancedEncounter (via FlavouredEncounter):
// - groups: FlavouredGroup[]        // Multi-Group-Support bleibt erhalten
// - features: Feature[]             // Aggregierte Features (Terrain + Weather + Indoor)
// - perception: EncounterPerception
// - balance: { targetDifficulty, actualDifficulty, partyWinProbability, tpkRisk, ... }
// - groupRelations?: GroupRelation[]
// - simulationResult?: SimulationResult  // Debug/Transparency

type EncounterDifficulty = 'trivial' | 'easy' | 'moderate' | 'hard' | 'deadly';
```

→ Vollstaendiges BalancedEncounter-Schema: [Adjustments.md](Adjustments.md#output-schema)

**Feld-Verwendung:**
- `features`: Immer - Environment-Features inkl. Hazards fuer GM-Anzeige (→ [Initiation.md](Initiation.md#feature-schema))
- `loot`, `hoard`: Bei hard/deadly Difficulty
- `leadNpc`, Shop-Link: Bei Haendler-NPCs
- `traceAge`, `trackingDC`: Bei trivial Difficulty (nur Spuren sichtbar)

### EncounterCreature

```typescript
interface EncounterCreature {
  creatureId: EntityId<'creature'>;
  npcId?: EntityId<'npc'>;              // Falls persistierter NPC
  count: number;
  role?: 'leader' | 'guard' | 'scout' | 'civilian';
  loot?: Item[];                        // Zugewiesene Items
}
```

### EncounterPerception

→ **Kanonisches Schema:** [Flavour.md#encounterperception-schema](Flavour.md#encounterperception-schema)

### EncounterOutcome

```typescript
interface EncounterOutcome {
  type: 'combat-victory' | 'combat-defeat' | 'fled' | 'negotiated' | 'ignored' | 'dismissed';
  creaturesKilled?: CreatureKill[];
  npcKilled?: EntityId<'npc'>[];  // Fuer NPC-Status-Transition
  lootClaimed?: boolean;
  xpAwarded?: number;
}

interface CreatureKill {
  creatureId: EntityId<'creature'>;
  factionId?: EntityId<'faction'>;  // Fuer Attrition
  count: number;
}
```

### Loot-Schemas

```typescript
interface GeneratedLoot {
  items: SelectedItem[];           // Enthaelt auch Currency-Items (Gold)
  totalValue: number;
}

interface Hoard {
  id: string;
  source: { type: 'encounter'; encounterId: string };
  items: GeneratedLoot;
  budgetValue: number;
  status: 'hidden' | 'discovered' | 'looted';
}
```

**Loot-Timing:**
- Loot wird in **Flavour (Step 4.4)** generiert, nicht bei Combat-Ende
- **Difficulty (Step 5)** prueft ob Gegner Items verwenden koennen → Simulation-Modifier
- Bei `encounter:generated` ist Loot bereits Teil der `FlavouredGroup.loot`
- Bei Post-Combat Resolution wird Loot verteilt, nicht generiert
- Optional: **Hoard** bei Boss/Lager Encounters

→ Loot-Generierung Details: [Flavour.md](Flavour.md#step-4-loot-generierung), [Loot-Feature.md](../Loot-Feature.md)

---

## Encounter-Verhalten nach Difficulty

| Difficulty | Verhalten | Resolution |
|------------|-----------|------------|
| **trivial** | Harmlose Begegnung, evtl. nur Spuren | Immediate (Beschreibung) |
| **easy** | Geringes Risiko | Manual (GM entscheidet) |
| **moderate** | Standard-Encounter | Manual (GM entscheidet) |
| **hard** | Gefaehrliches Encounter | Manual (GM entscheidet) |
| **deadly** | Sehr gefaehrlich, Combat wahrscheinlich | Combat-Feature |

---

## Konsumenten

### Combat-Integration

Bei deadly Difficulty und hostiler Disposition wird Combat-Feature aktiviert:

```
encounter:started (difficulty == 'deadly', hostile) -> combat:start-requested
```

**Environmental Features (inkl. Hazards)** werden als Teil des EncounterInstance publiziert. Sie sind Teil des `features[]`-Arrays und werden dem GM angezeigt.

**Wichtig:** Das Plugin ist **keine VTT** - Combat findet am Tisch statt. Hazards werden nur **angezeigt**, nicht automatisch angewendet. Der GM sieht z.B.:

```
┌──────────────────────────────────────────────────────────────┐
│ ⚠️ Umgebungsgefahren                                          │
├──────────────────────────────────────────────────────────────┤
│ • Dichte Dornen: 1d4 piercing, DEX DC 12 beim Durchqueren    │
│ • Instabiler Boden: STR DC 10 oder prone                     │
└──────────────────────────────────────────────────────────────┘
```

Der GM handhabt diese Effekte manuell am Tisch basierend auf den angezeigten Informationen.

-> Feature-Schema: [Initiation.md](Initiation.md#feature-schema)

### Gruppen-Relationen im Preview

Bei Multi-Group-Encounters werden die **Relationen zwischen den Gruppen** im Preview angezeigt:

```
┌──────────────────────────────────────────────────────────────┐
│ Encounter: Goblin-Patrouille vs Ork-Jaeger                   │
├──────────────────────────────────────────────────────────────┤
│ Gruppe 1: Goblin-Patrouille (threat)                         │
│   • 4x Goblin, 1x Goblin Boss                                │
│                                                              │
│ Gruppe 2: Ork-Jaeger (threat)                                │
│   • 2x Orc                                                   │
│                                                              │
│ ⚔️ Gruppen-Relation: hostile                                  │
│   Beide Gruppen sind feindlich zueinander.                   │
│   Effekt: Gruppen schwaehen sich gegenseitig in Simulation   │
└──────────────────────────────────────────────────────────────┘
```

| Relation | Icon | Beschreibung | Simulations-Effekt |
|----------|:----:|--------------|-----------|
| hostile | ⚔️ | Gruppen bekaempfen sich | Attackieren sich gegenseitig |
| neutral | ➖ | Gruppe 2 mischt sich nicht ein | Ignorieren sich |
| ally | 🤝 | Gruppe 2 unterstuetzt die Party | Kaempfen auf Party-Seite |

→ Simulations-Details: [Difficulty.md](Difficulty.md#faktor-integration)

### XP-System (40/60 Split)

Bei Quest-Encounters:

| XP-Anteil | Wann | Empfaenger |
|-----------|------|------------|
| **40%** | Sofort bei Encounter-Ende | Party direkt |
| **60%** | Bei Quest-Abschluss | Quest-Reward-Pool |

→ XP-Rewards: [Difficulty.md](Difficulty.md#xp-rewards-post-encounter)

### Shop-Integration

Bei Encounters mit Haendler-NPCs erfolgt die Shop-Verknuepfung ueber den NPC-Owner:

1. `ShopDefinition.npcOwnerId?: EntityId<'npc'>` verweist auf den Haendler-NPC
2. Wenn `encounter.leadNpc` einen Shop besitzt, zeigt das UI einen Shop-Link
3. **Kein separates `shopId`-Feld auf EncounterInstance noetig**

```typescript
// UI-Logik (nicht Schema)
function getShopForEncounter(encounter: EncounterInstance): Option<ShopDefinition> {
  if (!encounter.leadNpc) return None;
  return shopRegistry.findByNpcOwner(encounter.leadNpc.npcId);
}
```

→ Shop-Schema: [Shop.md](../../domain/Shop.md)

### Attrition-Integration

Nach Combat-Encounters werden getoetete Kreaturen von der Fraktion abgezogen:

```typescript
// Hook-Punkt: Nach encounter:resolved mit outcome.creaturesKilled
function applyAttrition(
  factionId: EntityId<'faction'>,
  creatureType: string,
  count: number
): void {
  const faction = entityRegistry.get('faction', factionId);
  const member = faction.members.find(m => m.creatureType === creatureType);

  if (member) {
    member.count = Math.max(0, member.count - count);

    // Status-Update bei Ausloeschung
    if (calculateTotalStrength(faction) === 0) {
      faction.status = 'extinct';
    }

    eventBus.publish('faction:attrition-applied', {
      factionId,
      creatureType,
      previousCount: member.count + count,
      newCount: member.count,
      correlationId: generateCorrelationId()
    });
  }
}
```

**Ablauf:**

```
encounter:resolved { outcome: { creaturesKilled: [...] } }
    ↓
Encounter-Service: Fraktions-Zuordnung pruefen
    ↓
Faction-Service: Counts reduzieren
    ↓
faction:attrition-applied { factionId, creatureType, previousCount, newCount }
    ↓
(Optional) faction:status-changed { factionId, previousStatus, newStatus }
```

**UI-Feedback:**

Nach Combat erscheint ein Info-Banner:
```
┌─────────────────────────────────────────────────────────────┐
│ ⚔️ Fraktions-Update                                         │
│ Die Bloodfang-Fraktion wurde geschwaecht (20 → 15 Goblins) │
└─────────────────────────────────────────────────────────────┘
```

→ Details: [Faction.md](../../domain/Faction.md#attrition-mechanik)

---

## Entity Promotion (Post-MVP)

Nach einem Encounter mit nicht-zugeordneten Kreaturen (ohne `factionId`) kann der GM die Kreatur zum persistenten NPC promoten.

### Trigger

```typescript
function shouldOfferPromotion(creature: EncounterCreature): boolean {
  // Nur nicht-zugeordnete Kreaturen (kein NPC-Link)
  if (creature.npcId) return false;

  // Kreatur hat ueberlebt oder wurde besiegt (beides relevant)
  return true;
}
```

### Promotion-Dialog (nach Encounter)

```
┌─────────────────────────────────────────────────────────────┐
│ Entity Promotion                                             │
├─────────────────────────────────────────────────────────────┤
│ "Junger Roter Drache" als persistenten NPC anlegen?         │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Vorgeschlagener POI:                                    │ │
│ │ Hoehle bei (12, 8)                                      │ │
│ │ [Map-Preview mit markiertem Hex]                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [ ] Hort erstellen (LootTable: Dragon Hoard)               │
│                                                             │
│ [Bestaetigen] [Anpassen...] [Ablehnen]                     │
└─────────────────────────────────────────────────────────────┘
```

### Ergebnis bei Bestaetigung

1. **NPC wird persistiert** (mit generiertem Name, Traits, etc.)
2. **Optional: POI erstellt** (Hort, Bau, Versteck)
3. **Optional: LootContainer erstellt** (aus defaultLootTable)
4. **Optional: Ein-Kreatur-Fraktion erstellt**

### POI-Vorschlag-Algorithmus

```typescript
function suggestPOILocation(
  encounterPosition: HexCoordinate,
  creatureType: Creature
): HexCoordinate {
  // 1. Terrain-Praeferenz beruecksichtigen
  const preferredTerrains = creatureType.terrainAffinities;

  // 2. Im Radius von 3 Hexes suchen
  const candidates = getHexesInRadius(encounterPosition, 3)
    .filter(hex => preferredTerrains.includes(hex.terrain));

  // 3. Ersten passenden Kandidaten waehlen
  return candidates[0] ?? encounterPosition;
}
```

### Events

```typescript
'entity:promotion-offered': {
  creatureId: EntityId<'creature'>;
  encounterId: string;
  suggestedPOI: HexCoordinate;
}

'entity:promoted': {
  npcId: EntityId<'npc'>;
  poiId?: EntityId<'poi'>;
  lootContainerId?: EntityId<'lootcontainer'>;
  factionId?: EntityId<'faction'>;
}
```

→ Details: [Faction.md](../../domain/Faction.md#entity-promotion)

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 3286 | ⬜ | Encounter | - | Publishing-Schemas: EncounterInstance, EncounterCreature, EncounterOutcome, CreatureKill | mittel | Nein | #3261 | - | - |
