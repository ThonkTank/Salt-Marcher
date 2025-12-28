# DetailView

> **Lies auch:** [Application](../architecture/Application.md), [SessionRunner](SessionRunner.md), [Combat-System.md](../features/Combat-System.md), [encounter/Encounter.md](../services/encounter/Encounter.md), [Shop.md](../data/shop.md)
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
| **Party** | Party-Mitglieder, HP-Tracking | Manuell (`[Manage →]` in SessionRunner) |

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
┌────────────────────────────────────────────────────────────┐
│  ENCOUNTER                                                  │
├────────────────────────────────────────────────────────────┤
│  [🔍 Gespeicherte Encounter suchen... ]                    │  ← Laedt in Builder
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Name: [Goblin Hinterhalt__________________]               │
│                                                             │
│  ─────── Situation ────────────────────────────────────── │
│                                                             │
│  Activity: [Patroullieren_________________]                │
│  Disposition: ████████░░ Neutral (20)                      │
│                                                             │
│  ─────── Detection ────────────────────────────────────── │
│                                                             │
│  Entdeckt: 👁️ Visuell, 180ft entfernt                      │
│  Party bemerkt: ✓  |  Encounter bemerkt Party: ✓           │
│                                                             │
│  ─────── Lead NPC ─────────────────────────────────────── │
│                                                             │
│  Griknak der Hinkende                                      │
│  ★ Wiederkehrender NPC (2 Begegnungen, zuletzt vor 5 Tagen)│
│                                                             │
│  Persoenlichkeit: misstrauisch, gierig                     │
│  Quirk: Hinkt auf dem linken Bein                          │
│  Ziel: Boss beeindrucken                                   │
│                                                             │
│  [Anderen NPC waehlen] [Neu generieren]                    │
│                                                             │
│  ─────── Kreaturen ────────────────────────────────────── │
│                                                             │
│  [🔍 Kreatur/NPC suchen...         ]                       │
│                                                             │
│  • Goblin Boss (CR 1)         [×]                          │
│  • Goblin ×3 (CR 1/4)         [×]                          │
│                                                             │
│  ─────── Encounter-Wertung ────────────────────────────── │
│                                                             │
│  Gesamt-XP: 450 XP                                         │
│  Difficulty: ████░ Medium                                  │
│  Tages-Budget: 45% verbraucht (450/1000 XP)               │
│                                                             │
│  ─────────────────────────────────────────────────────────│
│                                                             │
│  [🎲 Generate] [💾 Speichern] [⚔️ Combat starten]          │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Interaktionen:**

| Element | Aktion |
|---------|--------|
| `[🎲 Generate]` | Generiert Random Encounter basierend auf aktuellem Kontext (Terrain, Zeit, Wetter, Fraktion) |
| Encounter-Suche | Autocomplete fuer gespeicherte EncounterDefinitions, laedt in Builder |
| Name-Feld | Encounter-Name (fuer Speichern) |
| Activity-Feld | Was tut die Gruppe? (fuer alle Kreaturen, Kontext-basiert) |
| Disposition-Anzeige | Balken + Wert (-100 bis +100), zeigt Grundeinstellung zur Party |
| Detection-Anzeige | Readonly: Entdeckungsmethode, Distanz, beidseitige Awareness |
| Lead NPC-Sektion | Zeigt Name, Persoenlichkeit, Quirk, persoenliches Ziel |
| `[Anderen NPC waehlen]` | Dropdown zur Auswahl eines anderen NPCs aus der Kreaturen-Liste als Lead |
| `[Neu generieren]` | Generiert neuen Lead-NPC mit neuer Persoenlichkeit/Quirk |
| Kreatur/NPC-Suche | Autocomplete fuer CreatureDefinitions + Named NPCs aus Registry |
| `[×]` Button | Entfernt Kreatur/NPC aus Builder |
| `[💾 Speichern]` | Speichert als EncounterDefinition im Vault |
| `[⚔️ Combat starten]` | Startet Combat mit aktuellen Kreaturen, wechselt zu Combat-Tab |

**Sektionen:**

| Sektion | Inhalt | Quelle |
|---------|--------|--------|
| Situation | Activity + Disposition der Gruppe | BaseEncounterInstance |
| Detection | Entdeckungsmethode, Distanz, Awareness | EncounterPerception |
| Lead NPC | Persoenlichkeit, Quirk, Ziel, Wiederkehr-Info | NPC-Generation, EntityRegistry |
| Kreaturen | Liste aller Encounter-Kreaturen (ohne Lead) | EncounterCreature[] |
| Encounter-Wertung | XP, Difficulty, Budget | Encounter-Balancing |

**Encounter-Wertung (Live-Berechnung):**

| Anzeige | Berechnung |
|---------|------------|
| Gesamt-XP | Summe aller Creature-XP mit Gruppen-Multiplikator |
| Difficulty | Easy/Medium/Hard/Deadly basierend auf Party-Level |
| Tages-Budget | Prozent des Daily-XP-Budgets (siehe encounter/Difficulty.md) |

→ XP-Budget Details: [encounter/Difficulty.md](../services/encounter/Difficulty.md#xp-rewards-post-encounter)

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

**Phase 4: Faction Attrition (automatisch, Info-Banner)**

Nach Combat-Aufloesung werden getoetete Kreaturen von ihrer Fraktion abgezogen:

```
┌────────────────────────────────────────────────────────────┐
│  ⚔️ FRAKTIONS-UPDATE                                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Die Bloodfang-Fraktion wurde geschwaecht:                 │
│                                                            │
│  Goblin-Krieger:  20 → 15  (-5)                           │
│  Goblin-Boss:      3 →  2  (-1)                           │
│                                                            │
│  Gesamtstaerke:   -25%                                    │
│  Status:          Aktiv                                    │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│  [Verstanden ✓]                                            │
└────────────────────────────────────────────────────────────┘
```

**Bei Status-Aenderung:**

```
┌────────────────────────────────────────────────────────────┐
│  ⚔️ FRAKTION AUSGELOESCHT                                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Die Bloodfang-Fraktion wurde vernichtet!                  │
│                                                            │
│  Status: Aktiv → Ausgeloescht                              │
│                                                            │
│  Alle Praesenz auf der Map wurde entfernt.                │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│  [Verstanden ✓]                                            │
└────────────────────────────────────────────────────────────┘
```

**Automatisch:** Diese Phase erscheint nur wenn Kreaturen einer Fraktion getoetet wurden. Nicht-Fraktions-Kreaturen triggern keine Attrition.

→ Details: [Publishing.md](../services/encounter/Publishing.md#attrition-integration)

**Phase 5: Entity Promotion (optional, nur bei nicht-zugeordneten Kreaturen)**

Wenn im Encounter Kreaturen ohne Fraktions-Zuordnung waren, bietet das System an, sie zu persistieren:

```
┌────────────────────────────────────────────────────────────┐
│  🐉 ENTITY PROMOTION                                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  "Junger Roter Drache" als persistenten NPC anlegen?       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Vorgeschlagener POI:                                 │ │
│  │ 📍 Hoehle bei (12, 8)                                │ │
│  │ [Map-Preview mit markiertem Hex]                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [ ] Hort erstellen (LootTable: Dragon Hoard)             │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│  [Bestaetigen ✓]  [Anpassen...]  [Ablehnen ✗]             │
└────────────────────────────────────────────────────────────┘
```

**Bei mehreren Kreaturen:**

Wenn mehrere nicht-zugeordnete Kreaturen im Encounter waren, werden sie nacheinander angeboten:

```
Kreatur 1 von 3: "Junger Roter Drache"
[ ] Alle ablehnen
```

**Anpassen-Dialog:**

```
┌────────────────────────────────────────────────────────────┐
│  🐉 NPC-DETAILS ANPASSEN                                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Name:    [Scaldrath der Junge____________________]       │
│  Traits:  [gierig______] [territorial___]                 │
│                                                            │
│  POI-Typ:     [Entrance (Hoehle)    ▼]                    │
│  POI-Name:    [Scaldrath's Hort_________________]         │
│  Position:    (12, 8) [Auf Map aendern...]                │
│                                                            │
│  LootTable:   [Dragon Hoard        ▼]                     │
│  [ ] Fraktion erstellen (Ein-Kreatur-Fraktion)            │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│  [Speichern ✓]  [Zurueck ←]                               │
└────────────────────────────────────────────────────────────┘
```

**Ergebnis bei Bestaetigung:**
1. NPC wird in der Library persistiert
2. Optional: POI wird auf der Map erstellt
3. Optional: LootContainer wird aus LootTable generiert
4. Optional: Ein-Kreatur-Fraktion wird erstellt

→ Details: [Publishing.md](../services/encounter/Publishing.md#entity-promotion)
→ Encounter-Integration: [encounter/Encounter.md](../services/encounter/Encounter.md#entity-promotion)

**Events nach Resolution:**
- `encounter:resolved` wird gefeuert
- Wenn Quest zugewiesen: `quest:xp-accumulated`
- Wenn Loot verteilt: `loot:distributed`
- Wenn Attrition: `faction:attrition-applied`
- Wenn Entity Promotion: `npc:created`, optional `poi:created`, `lootcontainer:created`

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

→ Entity-Schema: [Shop.md](../data/shop.md)

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

**POI-Typ-Anzeige:**

| POI-Typ | Anzeige |
|---------|---------|
| `entrance` | Name + [Betreten]-Button |
| `landmark` | Name + Beschreibung |
| `trap` (detected) | Warnung + DC |
| `trap` (hidden) | Nicht angezeigt (GM-only) |
| `treasure` | Container + [Oeffnen]-Button |
| `object` | Name + [Interagieren]-Button |

→ POI-Schema: [poi.md](../data/poi.md)

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

→ Details: [Journal.md](../data/journal.md)

---

### Party-Tab

Party-Mitglieder Uebersicht mit HP-Tracking und Inventory-Zugriff.

```
┌────────────────────────────────────────┐
│  👥 PARTY                              │
├────────────────────────────────────────┤
│                                        │
│  PARTY STATS                           │
│  ────────────────────────────────────  │
│  Members: 4  │  Avg Level: 5           │
│  Travel Speed: 25 ft (Encumbered)      │
│                                        │
│  MEMBERS                               │
│  ────────────────────────────────────  │
│                                        │
│  ▶ Thorin                              │
│    HP: [10][+][-] 45/52  AC: 18  PP: 12│
│    [Inventory] [Remove]                │
│                                        │
│  ▼ Elara  (expanded)                   │
│    HP: [10][+][-] 28/28  AC: 13  PP: 14│
│    Speed: 30 ft                        │
│    Encumbrance: Light                  │
│    Level: 5 Wizard                     │
│    [Inventory] [Remove]                │
│                                        │
│  ────────────────────────────────────  │
│  [+ Add]                               │
│                                        │
└────────────────────────────────────────┘
```

**Elemente:**

| Element | Beschreibung |
|---------|--------------|
| `▶` / `▼` | Toggle fuer Collapsed/Expanded-Ansicht |
| `[10][+][-]` | HP-Eingabe: Wert eingeben, dann +/- druecken |
| `PP` | Passive Perception |
| `[Inventory]` | Oeffnet Inventory-Dialog fuer diesen Character |
| `[Remove]` | Entfernt Character aus Party (ohne Bestaetigung, Character existiert weiter in Library) |
| `[+ Add]` | Oeffnet Auswahl-Dialog mit Characters aus Library |

**Collapsed-Ansicht (Default):**
- Name
- HP (mit Eingabe + Buttons)
- AC
- Passive Perception

**Expanded-Ansicht:**
- Alles aus Collapsed
- Speed
- Encumbrance-Status
- Level + Class

**Party Stats:**
- Member Count
- Average Level
- Travel Speed (langsamster Character, mit Encumbrance)

**Wichtig:** Characters werden in der [Library](Library.md) erstellt und bearbeitet. Der Party-Tab ist nur fuer:
- Aktive Party-Mitglieder anzeigen
- HP-Tracking waehrend der Session
- Schneller Inventory-Zugriff
- Characters zur Party hinzufuegen/entfernen

→ Details: [Character-System.md](../features/Character-System.md)

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
  party: PartyTabState | null;
}

type TabId = 'encounter' | 'combat' | 'shop' | 'location' | 'quest' | 'journal' | 'party';

interface EncounterTabState {
  // Builder-State
  builderName: string;
  builderActivity: string;              // Was tut die Gruppe? (Gruppen-basiert)
  builderCreatures: BuilderCreature[];

  // Situation (NEU: fuer alle Encounter-Typen)
  disposition: number;                  // -100 bis +100, Grundeinstellung zur Party

  // Detection (NEU: aus Perception-System)
  detection: {
    method: 'visual' | 'auditory' | 'olfactory' | 'tremorsense' | 'magical';
    distance: number;                   // In feet
    partyAware: boolean;                // Hat Party das Encounter bemerkt?
    encounterAware: boolean;            // Hat Encounter die Party bemerkt?
  } | null;

  // Lead NPC (NEU: vollstaendige RP-Informationen)
  leadNPC: {
    npcId: EntityId<'npc'>;
    name: string;
    personality: {
      primary: string;                  // z.B. "misstrauisch"
      secondary?: string;               // z.B. "gierig"
    };
    quirk: string;                      // z.B. "Hinkt auf dem linken Bein"
    personalGoal: string;               // z.B. "Boss beeindrucken"
    isRecurring: boolean;               // Wiederkehrender NPC?
    encounterCount: number;             // Anzahl Begegnungen
    lastEncounter?: GameDateTime;       // Letzte Begegnung
  } | null;

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

interface PartyTabState {
  members: CharacterDisplay[];
  partyStats: {
    memberCount: number;
    averageLevel: number;
    travelSpeed: number;
    encumbranceStatus: 'light' | 'encumbered' | 'heavily' | 'over_capacity';
  };
}

interface CharacterDisplay {
  id: EntityId<'character'>;
  name: string;
  level: number;
  class: string;
  currentHp: number;
  maxHp: number;
  ac: number;
  passivePerception: number;
  speed: number;
  encumbrance: 'light' | 'encumbered' | 'heavily' | 'over_capacity';
  expanded: boolean;  // UI-State: collapsed oder expanded
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
  'journal:entry-added',

  // Party
  'party:member-added',
  'party:member-removed',
  'party:loaded',
  'entity:saved'             // Fuer Character-Updates
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

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|

---

