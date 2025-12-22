# DetailView

> **Lies auch:** [Application](../architecture/Application.md), [SessionRunner](SessionRunner.md)
> **Konsumiert:** Encounter, Combat, Shop, Quest, Journal

Kontextbezogene Detail-Ansichten fuer Session-relevante Informationen.

**Pfad:** `src/application/detail-view/`

**Companion View:** [SessionRunner](SessionRunner.md) (Center Leaf) fuer Map und Quick-Controls.

---

## Uebersicht

Die DetailView zeigt **kontextbezogene Details**, die nicht staendig sichtbar sein muessen:

| Tab | Zeigt | Auto-Open Trigger |
|-----|-------|-------------------|
| **Encounter** | Encounter-Preview, Generierung | `encounter:generated` |
| **Combat** | Initiative-Tracker, HP, Conditions | `combat:started` |
| **Shop** | Kaufen/Verkaufen bei Haendlern | Manuell |
| **Location** | Tile-Details, POIs, NPCs | `ui:tile-selected` (optional) |
| **Quest** | Quest-Details (expanded) | Manuell |
| **Journal** | Vollstaendige Ereignis-Historie | Manuell |

**Idle-State:** Leer (Placeholder mit Hinweis, dass Tabs manuell oder automatisch geoeffnet werden).

---

## Layout-Wireframe

### Standard-Layout (Right Leaf)

```
┌────────────────────────────────────┐
│  DETAIL VIEW                       │
├────────────────────────────────────┤
│  [Encounter] [Combat] [Shop] [···] │  ← Tab-Navigation
├────────────────────────────────────┤
│                                    │
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  │    Aktiver Tab-Inhalt        │  │
│  │                              │  │
│  │    (scrollbar bei Bedarf)    │  │
│  │                              │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘
```

### Idle-State (kein Tab aktiv)

```
┌────────────────────────────────────┐
│  DETAIL VIEW                       │
├────────────────────────────────────┤
│  [Encounter] [Combat] [Shop] [···] │
├────────────────────────────────────┤
│                                    │
│                                    │
│         Kein aktiver Kontext       │
│                                    │
│    Klicke auf einen Tab oder       │
│    generiere einen Encounter       │
│    im SessionRunner.               │
│                                    │
│                                    │
└────────────────────────────────────┘
```

---

## Tab-Beschreibungen

### Encounter-Tab

Encounter-Builder zum Erstellen, Bearbeiten und Starten von Encounters.

**Konzept:** Der Tab ist ein Builder, in den sowohl gespeicherte als auch generierte Encounters geladen werden. Der GM kann Kreaturen/NPCs hinzufuegen, entfernen und die Encounter-Details bearbeiten.

```
┌────────────────────────────────────────┐
│  ENCOUNTER                              │
├────────────────────────────────────────┤
│  [🔍 Gespeicherte Encounter suchen... ] │  ← Laedt in Builder
├────────────────────────────────────────┤
│                                         │
│  Name: [Goblin Hinterhalt____________]  │
│                                         │
│  ─────── Kreaturen/NPCs ─────────────  │
│                                         │
│  [🔍 Kreatur/NPC suchen...         ]   │
│                                         │
│  • Goblin Boss (CR 1)         [×]      │
│  • Goblin ×3 (CR 1/4)         [×]      │
│  • Griknak (NPC, Goblin)      [×]      │
│                                         │
│  ─────── Kontext ────────────────────  │
│                                         │
│  Activity: [Patroullieren_____________] │
│  Goal:     [Reisende ausrauben________] │
│                                         │
│  ─────── Encounter-Wertung ──────────  │
│                                         │
│  Gesamt-XP: 450 XP                      │
│  Difficulty: ████░ Medium               │
│  Tages-Budget: 45% verbraucht           │
│             (450/1000 XP)               │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [🎲 Generate] [💾 Speichern] [⚔️ Combat starten]    │
│                                         │
└────────────────────────────────────────┘
```

**Interaktionen:**

| Element | Aktion |
|---------|--------|
| `[🎲 Generate]` | Generiert Random Encounter basierend auf aktuellem Kontext (Terrain, Zeit, Wetter, Fraktion) |
| Encounter-Suche | Autocomplete fuer gespeicherte EncounterDefinitions, laedt in Builder |
| Kreatur/NPC-Suche | Autocomplete fuer CreatureDefinitions + Named NPCs aus Registry |
| `[×]` Button | Entfernt Kreatur/NPC aus Builder |
| Name-Feld | Encounter-Name (fuer Speichern) |
| Activity-Feld | Was tun die Kreaturen? (z.B. "Patroullieren") |
| Goal-Feld | Was wollen die Kreaturen? (z.B. "Reisende ausrauben") |
| `[💾 Speichern]` | Speichert als EncounterDefinition im Vault |
| `[⚔️ Combat starten]` | Startet Combat mit aktuellen Kreaturen, wechselt zu Combat-Tab |

**Encounter-Wertung (Live-Berechnung):**

| Anzeige | Berechnung |
|---------|------------|
| Gesamt-XP | Summe aller Creature-XP mit Gruppen-Multiplikator |
| Difficulty | Easy/Medium/Hard/Deadly basierend auf Party-Level |
| Tages-Budget | Prozent des Daily-XP-Budgets (siehe Encounter-Balancing.md) |

→ XP-Budget Details: [Encounter-Balancing.md](../features/Encounter-Balancing.md#xp-budget)

**Quellen fuer Kreaturen:**

| Quelle | Beschreibung |
|--------|--------------|
| CreatureDefinitions | Templates aus dem Vault (Goblin, Wolf, etc.) |
| Named NPCs | Persistierte NPCs aus NPC-Registry (Griknak, Eldara, etc.) |

**Builder-Befuellung:**

| Trigger | Verhalten |
|---------|-----------|
| `encounter:generated` Event | Builder wird mit generiertem Encounter befuellt |
| Gespeichertes Encounter laden | Builder wird mit EncounterDefinition befuellt |
| Manuell | User fuegt Kreaturen einzeln hinzu |

### Combat-Tab

Initiative-Tracker und HP-Management.

```
┌────────────────────────────────────┐
│  ⚔️ COMBAT - Runde 3               │
├────────────────────────────────────┤
│                                    │
│  Initiative:                       │
│  ───────────────────────────────── │
│  ▶ 18: Goblin Boss                 │
│        HP: 15/35 ████░░░░░░        │
│        [Frightened 💀]             │
│                                    │
│    15: Thorin (Player)             │
│        HP: 45/52 █████████░        │
│        [Poisoned 🤢]               │
│                                    │
│    12: Elara (Player)              │
│        HP: 28/28 ██████████        │
│        [Concentrating 🔮: Haste]   │
│                                    │
│    10: Goblin 1                    │
│        HP: 0/7 💀                  │
│                                    │
│     8: Goblin 2                    │
│        HP: 4/7 █████░░░░░          │
│                                    │
│  ───────────────────────────────── │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ [Damage] [Heal] [Condition]  │  │
│  │ [Add Effect] [Next Turn]     │  │
│  │ [End Combat]                 │  │
│  └──────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘
```

**Interaktionen:**

| Button | Aktion |
|--------|--------|
| `[Damage]` | Oeffnet Damage-Dialog fuer selektierten Participant |
| `[Heal]` | Oeffnet Heal-Dialog |
| `[Condition]` | Fuegt Condition hinzu (Dropdown) |
| `[Add Effect]` | Fuegt Custom-Effect hinzu (Start/End-of-Turn) |
| `[Next Turn]` | Naechster Participant in Initiative |
| `[End Combat]` | Beendet Combat, XP-Verteilung |

**Turn-Wechsel zeigt Effekte:**

```
┌────────────────────────────────────┐
│  ⚠️ Start of Turn: Goblin Boss     │
├────────────────────────────────────┤
│                                    │
│  Tasha's Caustic Brew              │
│  ───────────────────────────────── │
│  Save: DC 13 DEX                   │
│  Bei Fail: 2d4 acid damage         │
│  Bei Success: Effekt endet         │
│                                    │
│  [Save erfolgt] [Save fehlgeschlag]│
│                                    │
└────────────────────────────────────┘
```

→ Details: [Combat-System.md](../features/Combat-System.md)

### Post-Combat Resolution

Nach `combat:completed` wechselt der Combat-Tab in den Resolution-Modus mit linearem Flow:

**Phase 1: XP-Summary (automatisch, GM-anpassbar)**

```
┌────────────────────────────────────────────────────────────┐
│  ⚔️ COMBAT RESOLVED - Victory                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  XP-UEBERSICHT                                             │
│  ─────────────────────────────────────────────────────────│
│  Basis-XP:            450 XP                               │
│  GM-Anpassung:        [-] [  0% ] [+]   ← editierbar      │
│  Gesamt-XP:           450 XP                               │
│                                                            │
│  Verteilung:                                               │
│  ├── Sofort (40%):    180 XP                              │
│  └── Quest-Pool:      270 XP  ← nur bei Quest-Encounter   │
│                                                            │
│  Pro Charakter (4):    45 XP sofort                       │
│                                                            │
│  Besiegte Gegner:                                          │
│  ├── Goblin Boss (CR 1)      200 XP                       │
│  └── Goblin ×3 (CR 1/4)      150 XP                       │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│  [Weiter →]                              [Ueberspringen ✗] │
└────────────────────────────────────────────────────────────┘
```

**GM-Anpassung:** [-10%, -5%, 0%, +5%, +10%, +25%, +50%] Schnellauswahl oder freie Prozent-Eingabe.

**Phase 2: Quest-Zuweisung (im selben Panel wie XP)**

```
┌────────────────────────────────────────────────────────────┐
│  📜 QUEST-ZUWEISUNG                                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Quest-XP Pool: 270 XP (60% von 450)                       │
│                                                            │
│  Quest-Suche: [________________🔍]                         │
│                                                            │
│  Aktive Quests:                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ○ "Goblin-Hoehle saeubern"                           │ │
│  │   +270 XP zum Quest-Pool (aktuell: 150 XP)           │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ ○ "Strassen sichern"                                 │ │
│  │   +270 XP zum Quest-Pool (aktuell: 0 XP)             │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ ● Keiner Quest zuweisen                              │ │
│  │   Quest-Pool XP verfallen (270 XP)                   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [Zuweisen →]                            [Ueberspringen ✗] │
└────────────────────────────────────────────────────────────┘
```

**Quest-Suche:** Filtert nicht-abgeschlossene Quests nach Name. GM waehlt manuell - kein automatisches Slot-Matching.

**Phase 3: Loot-Verteilung**

```
┌────────────────────────────────────────────────────────────┐
│  💰 LOOT-VERTEILUNG                                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Generierter Loot (Wert: ~200 GP):                        │
│                                                            │
│  ITEMS                                                     │
│  ├── Kurzschwert (10 GP)         → [Thorin    ▼]          │
│  ├── Lederharnisch (15 GP)       → [niemand   ▼]          │
│  └── Heiltrank ✨ (50 GP)        → [Elara     ▼]          │
│                                                            │
│  GOLD                                                      │
│  └── 125 GP                      [Gleichmaessig verteilen]│
│      Thorin: 31 GP | Elara: 31 GP | Grimm: 31 GP | Luna: 32│
│                                                            │
│  ─────────────────────────────────────────────────────────│
│  [Verteilen →]                           [Ueberspringen ✗] │
└────────────────────────────────────────────────────────────┘
```

**Ueberspringen-Verhalten:**

| Phase | Bei Ueberspringen |
|-------|-------------------|
| XP-Summary | XP wird trotzdem vergeben |
| Quest-Zuweisung | Quest-Pool XP verfallen |
| Loot-Verteilung | Loot verfaellt |

**Events nach Resolution:**
- `encounter:resolved` wird gefeuert
- Wenn Quest zugewiesen: `quest:xp-accumulated`
- Wenn Loot verteilt: `loot:distributed`

→ Details: [Combat-System.md](../features/Combat-System.md#post-combat-resolution)

### Shop-Tab

Interaktion mit Haendlern.

```
┌────────────────────────────────────┐
│  🏪 Blacksmith's Forge             │
├────────────────────────────────────┤
│                                    │
│  Search: [________________] 🔍     │
│  Filter: [All Items ▼]             │
│                                    │
│  ───────────────────────────────── │
│  🗡️ Longsword            15 gp    │
│     [Buy]                          │
│  🛡️ Shield               10 gp    │
│     [Buy]                          │
│  ⚔️ Greatsword           50 gp    │
│     [Buy]                          │
│  🥋 Chain Mail           75 gp    │
│     [Buy]                          │
│  ───────────────────────────────── │
│                                    │
│  [Load More...]     Showing 4/23   │
│                                    │
├────────────────────────────────────┤
│  💰 Party Gold: 250 gp             │
│  [Sell Items...]                   │
└────────────────────────────────────┘
```

**Verkaufs-Modus:**

```
┌────────────────────────────────────┐
│  🏪 Sell to Blacksmith's Forge     │
├────────────────────────────────────┤
│                                    │
│  Party Inventory:                  │
│  ───────────────────────────────── │
│  🗡️ Rusty Sword           2 gp    │
│     [Sell]                         │
│  🛡️ Cracked Shield        1 gp    │
│     [Sell]                         │
│  ───────────────────────────────── │
│                                    │
├────────────────────────────────────┤
│  💰 Party Gold: 250 gp             │
│  [Back to Shop]                    │
└────────────────────────────────────┘
```

→ Entity-Schema: [Shop.md](../domain/Shop.md)

### Location-Tab

Details zum aktuell ausgewaehlten Tile oder POI.

```
┌────────────────────────────────────┐
│  📍 LOCATION                       │
├────────────────────────────────────┤
│                                    │
│  Hex: (12, 8)                      │
│                                    │
│  Terrain                           │
│  ───────────────────────────────── │
│  Type: Forest                      │
│  Elevation: 450m                   │
│  Movement Cost: 0.6                │
│                                    │
│  Weather (aktuell)                 │
│  ───────────────────────────────── │
│  Clear Skies                       │
│  Temp: 18°C (comfortable)          │
│  Wind: 8 mph NW                    │
│                                    │
│  POIs auf diesem Tile              │
│  ───────────────────────────────── │
│  🏠 Silverwood Village             │
│     Population: ~200               │
│     [Details →]                    │
│                                    │
│  Fraktions-Praesenz                │
│  ───────────────────────────────── │
│  • Elven Council (75%)             │
│  • Bandits (15%)                   │
│                                    │
│  Bekannte NPCs                     │
│  ───────────────────────────────── │
│  • Eldara (Elven Merchant)         │
│  • Grimtooth (Bandit Leader)       │
│                                    │
└────────────────────────────────────┘
```

### Quest-Tab

Erweiterte Quest-Ansicht.

```
┌────────────────────────────────────┐
│  📜 QUEST: The Goblin Cave         │
├────────────────────────────────────┤
│                                    │
│  Status: Active                    │
│  Progress: 2/4 Objectives          │
│                                    │
│  Description                       │
│  ───────────────────────────────── │
│  Clear the goblin cave that has    │
│  been threatening the village.     │
│                                    │
│  Objectives                        │
│  ───────────────────────────────── │
│  ☑️ Find the cave entrance         │
│  ☑️ Defeat the goblin scouts       │
│  ☐ Kill or drive off the boss      │
│  ☐ Return to the village elder     │
│                                    │
│  Encounters                        │
│  ───────────────────────────────── │
│  • Goblin Scouts (completed)       │
│    → 150 XP (40% = 60 XP sofort)   │
│  • Goblin Boss (pending)           │
│    [Start Encounter]               │
│                                    │
│  Rewards                           │
│  ───────────────────────────────── │
│  • 200 gp                          │
│  • 60% Quest-XP Pool: 90 XP        │
│  • Reputation: +1 with Village     │
│                                    │
│  [Complete Quest] [Abandon]        │
│                                    │
└────────────────────────────────────┘
```

→ Details: [Quest-System.md](../features/Quest-System.md)

### Journal-Tab

Vollstaendige Ereignis-Historie.

```
┌────────────────────────────────────┐
│  📖 JOURNAL                        │
├────────────────────────────────────┤
│                                    │
│  Filter: [All ▼] [Today ▼]         │
│                                    │
│  ─────── 15. Mirtul, 1492 ──────── │
│                                    │
│  14:30 - Arrived at Silverwood     │
│          Village                   │
│                                    │
│  12:15 - Weather changed to Clear  │
│                                    │
│  10:30 - Encounter: Wolf Pack      │
│          (resolved - 200 XP)       │
│          [Details →]               │
│                                    │
│  08:00 - Departed from Dragon's    │
│          Rest                      │
│                                    │
│  ─────── 14. Mirtul, 1492 ──────── │
│                                    │
│  22:00 - Long Rest at Dragon's     │
│          Rest Inn                  │
│                                    │
│  ...                               │
│                                    │
├────────────────────────────────────┤
│  [+ Quick Note]                    │
│  [Export Journal]                  │
└────────────────────────────────────┘
```

→ Details: [Journal.md](../domain/Journal.md)

---

## Auto-Open Verhalten

Die DetailView oeffnet automatisch bestimmte Tabs basierend auf Events:

| Event | Aktion |
|-------|--------|
| `encounter:generated` | Oeffnet Encounter-Tab |
| `combat:started` | Wechselt zu Combat-Tab |
| `combat:ended` | Bleibt auf Combat-Tab (Summary) |
| `ui:tile-selected` | Oeffnet Location-Tab (optional, konfigurierbar) |

**Manuelles Override:** User kann jederzeit zu einem anderen Tab wechseln. Auto-Open unterbricht nur wenn kein Tab aktiv ist oder der aktive Tab "niedriger priorisiert" ist.

**Tab-Prioritaet (hoechste zuerst):**
1. Combat (wenn aktiv)
2. Encounter (wenn pending)
3. Alle anderen (manuell)

---

## State-Synchronisation

### ViewModel-State

```typescript
interface DetailViewState {
  activeTab: TabId | null;        // null = Idle/Empty

  // Tab-spezifischer State
  encounter: EncounterTabState | null;
  combat: CombatTabState | null;
  shop: ShopTabState | null;
  location: LocationTabState | null;
  quest: QuestTabState | null;
  journal: JournalTabState | null;
}

type TabId = 'encounter' | 'combat' | 'shop' | 'location' | 'quest' | 'journal';

interface EncounterTabState {
  // Builder-State
  builderName: string;
  builderActivity: string;              // Was tun die Kreaturen?
  builderGoal: string;                  // Was wollen die Kreaturen?
  builderCreatures: BuilderCreature[];

  // Berechnete Werte (live)
  totalXP: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
  dailyBudgetUsed: number;              // Bereits verbraucht heute
  dailyBudgetTotal: number;             // Tages-Budget der Party

  // Suche
  savedEncounterQuery: string;
  creatureQuery: string;

  // Quelle (fuer Save-Logik: Update vs Create)
  sourceEncounterId: EntityId<'encounter'> | null;
}

interface BuilderCreature {
  type: 'creature' | 'npc';
  entityId: EntityId<'creature'> | EntityId<'npc'>;
  name: string;
  cr: number;
  xp: number;
  count: number;
}

interface CombatTabState {
  combatState: CombatState;
  pendingEffects: CombatEffect[];  // Start/End-of-Turn

  // Post-Combat Resolution State
  resolution: ResolutionState | null;
}

interface ResolutionState {
  phase: 'xp' | 'quest' | 'loot' | 'done';
  baseXP: number;
  gmModifierPercent: number;       // -50 bis +100
  adjustedXP: number;
  selectedQuestId: EntityId<'quest'> | null;
  lootDistribution: Map<EntityId<'character'>, Item[]>;
}

interface ShopTabState {
  activeShop: Shop | null;
  searchQuery: string;
  filter: ItemFilter;
  mode: 'buy' | 'sell';
}

interface LocationTabState {
  selectedTile: HexCoordinate | null;
  tileData: TileDetails | null;
}

interface QuestTabState {
  selectedQuest: Quest | null;
}

interface JournalTabState {
  filter: JournalFilter;
  entries: JournalEntry[];
}
```

### Event-Subscriptions

```typescript
// DetailView-ViewModel subscribed auf:
const subscriptions = [
  // Auto-Open Triggers
  'encounter:generated',
  'combat:started',
  'combat:ended',

  // State-Sync
  'encounter:state-changed',
  'combat:state-changed',
  'combat:turn-changed',
  'combat:participant-hp-changed',

  // Optional (von SessionRunner)
  'ui:tile-selected',

  // Journal
  'journal:entry-added'
];
```

---

## Interaktions-Flows

### Flow: Gespeichertes Encounter laden

```
User tippt in Encounter-Suche
    │
    ▼
Autocomplete zeigt passende EncounterDefinitions aus Vault
    │
    ▼
User waehlt Encounter aus
    │
    ▼
Builder wird mit Encounter-Daten befuellt:
├── Name, Activity, Goal
├── Kreaturen-Liste
└── sourceEncounterId wird gesetzt
    │
    ▼
Difficulty + Budget werden neu berechnet
```

### Flow: Neues Encounter im Builder erstellen

```
User sucht Kreatur/NPC in Kreatur-Suche
    │
    ▼
Autocomplete zeigt CreatureDefinitions + Named NPCs
    │
    ▼
User waehlt aus (+ Button oder Enter)
    │
    ▼
Kreatur wird zu builderCreatures hinzugefuegt
    │
    ▼
Difficulty + Budget werden live neu berechnet
```

### Flow: Random Encounter → Builder

```
encounter:generated Event (aus Travel oder SessionRunner)
    │
    ▼
DetailView oeffnet Encounter-Tab
    │
    ▼
Builder wird mit generiertem Encounter befuellt:
├── Name aus Encounter-Type
├── Activity + Goal aus Generierung
├── Kreaturen aus EncounterInstance
└── sourceEncounterId = null (neu, nicht gespeichert)
    │
    ▼
User kann modifizieren, speichern oder Combat starten
```

### Flow: Builder → Combat

```
User klickt [Combat starten]
    │
    ▼
ViewModel erstellt CombatParticipant[] aus builderCreatures
    │
    ▼
ViewModel: eventBus.publish('combat:start-requested', { participants })
    │
    ▼
Combat-Feature startet Combat
    │
    ▼
combat:started Event
    │
    ▼
DetailView wechselt automatisch zu Combat-Tab
```

### Flow: Builder → Speichern

```
User klickt [Speichern]
    │
    ▼
ViewModel erstellt EncounterDefinition aus Builder-State:
├── name, activity, goal
├── creatureSlots aus builderCreatures
└── id aus sourceEncounterId oder neu generiert
    │
    ▼
ViewModel: entityRegistry.save('encounter', definition)
    │
    ▼
sourceEncounterId wird gesetzt (fuer Update bei erneutem Speichern)
```

### Flow: Combat beenden

```
User klickt [End Combat] in Combat-Tab
    │
    ▼
ViewModel: eventBus.publish('combat:end-requested')
    │
    ▼
Combat-Feature beendet Combat
    │
    ├── XP-Berechnung
    ├── Zeit-Advance (6s × Runden)
    └── Encounter resolved
    │
    ▼
combat:ended Event
    │
    ▼
Combat-Tab zeigt Summary (XP, Casualties)
    │
    ▼
User kann Tab schliessen oder zu anderem wechseln
```

### Flow: Shop oeffnen

```
User waehlt "Open Shop" aus Location-Tab
    │ (oder GM oeffnet manuell via Command)
    ▼
ViewModel: setActiveTab('shop')
ViewModel: loadShop(shopId)
    │
    ▼
Shop-Tab zeigt Haendler-Inventar
```

---

## Keyboard-Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `1` | Encounter-Tab |
| `2` | Combat-Tab |
| `3` | Shop-Tab |
| `4` | Location-Tab |
| `5` | Quest-Tab |
| `6` | Journal-Tab |
| `Escape` | Tab schliessen (Idle-State) |
| `N` | Next Turn (in Combat) |
| `D` | Damage-Dialog (in Combat) |
| `H` | Heal-Dialog (in Combat) |

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Encounter-Tab | ✓ | | Kern-Funktionalitaet |
| Combat-Tab | ✓ | | Initiative-Tracker |
| Shop-Tab | ✓ | | Kaufen/Verkaufen |
| Location-Tab | ✓ | | Tile-Details |
| Quest-Tab | | mittel | Expanded Quest-View |
| Journal-Tab | | mittel | Vollstaendige Historie |
| Auto-Open Encounter | ✓ | | User-Experience |
| Auto-Open Combat | ✓ | | User-Experience |
| Keyboard-Shortcuts | | niedrig | Power-User |

---

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 2400 | DetailView View Component (Hauptcontainer mit Tab-Navigation) | hoch | Ja | - | DetailView.md#layout-wireframe |
| 2401 | DetailView ViewModel mit State-Management | hoch | Ja | #2400 | DetailView.md#state-synchronisation, Application.md#viewmodel-pattern |
| 2402 | Tab-Management (activeTab State, setActiveTab) | hoch | Ja | #2401 | DetailView.md#tab-management |
| 2403 | Idle-State Placeholder (Hinweis wenn kein Tab aktiv) | mittel | Ja | #2400 | DetailView.md#idle-state |
| 2404 | Auto-Open Verhalten für Encounter-Tab (encounter:generated) | hoch | Ja | #2401, #220 | DetailView.md#auto-open-verhalten, Encounter-System.md#events, Events-Catalog.md#encounter |
| 2405 | Auto-Open Verhalten für Combat-Tab (combat:started) | hoch | Ja | #2401, #322 | DetailView.md#auto-open-verhalten, Combat-System.md#combat-flow, Events-Catalog.md#combat |
| 2406 | Auto-Open Verhalten für Location-Tab (ui:tile-selected, optional) | niedrig | Nein | #2401, #2448 | DetailView.md#auto-open-verhalten |
| 2407 | Tab-Priorität System (Combat > Encounter > Rest) | mittel | Ja | #2402 | DetailView.md#auto-open-verhalten |
| 2408 | Encounter-Tab Component (Container) | hoch | Ja | #2400, #2409, b5 | DetailView.md#encounter-tab |
| 2409 | Encounter-Builder State (Name, Activity, Goal, Creatures) | hoch | Ja | #2401 | DetailView.md#encounter-tab, Encounter-System.md#schemas |
| 2410 | Encounter-Suche (Autocomplete für gespeicherte EncounterDefinitions) | mittel | Ja | #2408, #2409 | DetailView.md#encounter-tab, Encounter-System.md#schemas |
| 2411 | Kreatur/NPC-Suche (Autocomplete für CreatureDefinitions + Named NPCs) | hoch | Ja | #2408, #2409 | DetailView.md#encounter-tab, Creature.md#schema, NPC-System.md#npc-schema |
| 2412 | Kreatur/NPC hinzufügen zum Builder | hoch | Ja | #2409, #2411 | DetailView.md#encounter-tab, DetailView.md#flow-neues-encounter-im-builder-erstellen |
| 2413 | Kreatur/NPC entfernen aus Builder ([×] Button) | mittel | Ja | #2409, #2412 | DetailView.md#encounter-tab |
| 2414 | Encounter-Wertung Live-Berechnung (Gesamt-XP, Difficulty, Daily-Budget) | hoch | Ja | #2409, #1400 | DetailView.md#encounter-tab, Encounter-Balancing.md#xp-budget, Encounter-Balancing.md#cr-vergleich |
| 2415 | Encounter-Builder befüllen aus encounter:generated Event | hoch | Ja | #2404, #2409 | DetailView.md#encounter-tab, DetailView.md#flow-random-encounter-builder, Encounter-System.md#events |
| 2416 | Encounter-Builder befüllen aus gespeichertem Encounter | mittel | Ja | #2409, #2410 | DetailView.md#flow-gespeichertes-encounter-laden, Encounter-System.md#schemas |
| 2417 | Encounter-Speichern Funktion (Create/Update) | mittel | Ja | #2409 | DetailView.md#flow-builder-speichern, Encounter-System.md#schemas |
| 2418 | Combat-Start aus Encounter-Builder | hoch | Ja | #2409, #321 | DetailView.md#flow-builder-combat, Combat-System.md#combat-flow, Encounter-System.md#integration |
| 2419 | Combat-Tab Component (Container) | hoch | Ja | #2400, #305 | DetailView.md#combat-tab, Combat-System.md#schemas |
| 2420 | Combat-Tab ViewModel (Initiative-Liste, HP-Tracking) | hoch | Ja | #2401, #2419 | DetailView.md#combat-tab, DetailView.md#state-synchronisation, Combat-System.md#combatstate |
| 2421 | Initiative-Tracker Display (Sortierte Liste mit aktuellem Turn) | hoch | Ja | #2419, #2420 | DetailView.md#combat-tab, Combat-System.md#sortierung, Combat-System.md#initiative-layout |
| 2422 | HP-Management Controls (Damage/Heal Dialogs) | hoch | Ja | #308, #309, #2420, #2421 | DetailView.md#combat-tab, Combat-System.md#damage-heal |
| 2423 | Condition-Management (Add/Remove Conditions) | hoch | Ja | #312, #313, #2420, #2421 | DetailView.md#combat-tab, Combat-System.md#conditions |
| 2424 | Turn-Wechsel Handler (Next Turn Button) | hoch | Ja | #319, #2419, #2420 | DetailView.md#combat-tab, Combat-System.md#combat-flow, Combat-System.md#automatische-effekte |
| 2425 | Start-of-Turn Effects Display | hoch | Ja | #2419, #2424 | DetailView.md#combat-tab, Combat-System.md#start-of-turn |
| 2426 | End-of-Turn Effects Display | hoch | Ja | #2419, #2424 | DetailView.md#combat-tab, Combat-System.md#end-of-turn |
| 2427 | Combat-Ende Handler (End Combat Button) | hoch | Ja | #323, #2419, #2420 | DetailView.md#flow-combat-beenden, Combat-System.md#combat-flow |
| 2428 | Post-Combat Resolution: XP-Summary Phase | hoch | Ja | #338, #339, #340, #2419, #2427 | DetailView.md#post-combat-resolution, Combat-System.md#post-combat-resolution, Combat-System.md#xp-berechnung |
| 2429 | Post-Combat Resolution: GM-Anpassung XP (%-Modifier) | hoch | Ja | #2419, #2428 | DetailView.md#post-combat-resolution, Combat-System.md#xp-berechnung |
| 2430 | Post-Combat Resolution: Quest-Zuweisung Phase | hoch | Ja | #408, #409, #2420, #2427, #2428 | DetailView.md#post-combat-resolution, Quest-System.md#quest-assignment-ui-post-combat, Quest-System.md#40-60-split-mechanik, Combat-System.md#post-combat-resolution |
| 2431 | Post-Combat Resolution: Loot-Verteilung Phase | hoch | Ja | #2420, #2428, #2801, #2802 | DetailView.md#post-combat-resolution, Loot-Feature.md#verteilen-einheitliches-loot-modal, Loot-Feature.md#loot-generierung-bei-encounter, Combat-System.md#post-combat-resolution |
| 2432 | Shop-Tab Component (Buy/Sell Interface) | hoch | Ja | #2400, #2419, #2431 | DetailView.md#shop-tab, Shop.md#verwendung |
| 2433 | Shop-Tab ViewModel (Shop-State, Inventory) | hoch | Ja | #2432 | DetailView.md#shop-tab, DetailView.md#state-synchronisation, Shop.md#schema |
| 2434 | Shop-Item Browse mit Search/Filter | hoch | Ja | #2432, #2433 | DetailView.md#shop-tab, Shop.md#queries |
| 2435 | Buy-Transaktion Handler | hoch | Ja | #2433, #2434 | DetailView.md#shop-tab, Shop.md#preis-berechnung, Shop.md#events |
| 2436 | Sell-Transaktion Handler | hoch | Ja | #2433, #2434 | DetailView.md#shop-tab, Shop.md#preis-berechnung, Shop.md#events |
| 2437 | Location-Tab Component (Tile/POI Details) | hoch | Ja | #2400, #2436 | DetailView.md#location-tab, POI.md#tile-content-panel |
| 2438 | Location-Tab ViewModel (Tile-Data) | hoch | Ja | #2436, #2437 | DetailView.md#location-tab, DetailView.md#state-synchronisation, POI.md#queries |
| 2439 | Terrain/Elevation/Climate Display | hoch | Ja | #2431, #2432, #2434, #2436, #2438 | DetailView.md#location-tab, Terrain.md#schema, Weather-System.md#weather-state |
| 2440 | POIs auf Tile anzeigen | hoch | Ja | #2431, #2432, #2438 | DetailView.md#location-tab, POI.md#tile-content-panel, POI.md#queries |
| 2441 | Fraktionspräsenz Display | hoch | Ja | #2431, #2435, #2437, #2438 | DetailView.md#location-tab, Faction.md#praesenz-datenstruktur, Faction.md#encounter-integration |
| 2442 | Bekannte NPCs Display | hoch | Ja | #2400, #2438 | DetailView.md#location-tab, NPC-System.md#npc-schema, NPC-System.md#mvp-fraktions-basierte-location |
| 2443 | Quest-Tab Component (Quest-Details) | mittel | Nein | #2400, #2401 | DetailView.md#quest-tab, Quest.md#schema |
| 2444 | Quest-Tab ViewModel (Quest-State) | mittel | Nein | #2442, #2443 | DetailView.md#quest-tab, DetailView.md#state-synchronisation, Quest-System.md#quest-progress-runtime-state |
| 2445 | Objective-Tracker Display (Checkboxen) | mittel | Nein | #2442, #2443, #2444 | DetailView.md#quest-tab, Quest-System.md#quest-schema-entityregistry, Quest.md#questobjective |
| 2446 | Quest-Actions (Complete/Fail/Abandon) | mittel | Nein | #2442, #2443, #2444 | DetailView.md#quest-tab, Quest-System.md#quest-state-machine, Quest.md#events |
| 2447 | Journal-Tab Component (Event-Historie) | mittel | Nein | #2400, #2444 | DetailView.md#journal-tab, Journal.md#schema |
| 2448 | Journal-Tab ViewModel (Entry-Liste, Filter) | mittel | Nein | #2400, #2447 | DetailView.md#journal-tab, DetailView.md#state-synchronisation, Journal.md#queries |
| 2449 | Journal-Filter Controls (Date, Category, Tags) | mittel | Nein | #2401, #2448 | DetailView.md#journal-tab, Journal.md#schema |
| 2450 | Quick Note Entry | mittel | Nein | #2448, #2449 | DetailView.md#journal-tab, Journal.md#journalentry |

---

*Siehe auch: [SessionRunner.md](SessionRunner.md) | [Combat-System.md](../features/Combat-System.md) | [Encounter-System.md](../features/Encounter-System.md) | [Shop.md](../domain/Shop.md)*
