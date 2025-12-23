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
| Lead NPC | Persoenlichkeit, Quirk, Ziel, Wiederkehr-Info | NPC-System, NPC-Registry |
| Kreaturen | Liste aller Encounter-Kreaturen (ohne Lead) | EncounterCreature[] |
| Encounter-Wertung | XP, Difficulty, Budget | Encounter-Balancing |

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

→ Details: [Faction.md](../domain/Faction.md#attrition-mechanik)

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

→ Details: [Faction.md](../domain/Faction.md#entity-promotion)
→ Encounter-Integration: [Encounter-System.md](../features/Encounter-System.md#entity-promotion)

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

| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 2400 | ✅ | Application/DetailView | DetailView View Component (Hauptcontainer mit Tab-Navigation) | hoch | Ja | - | DetailView.md#uebersicht | src/application/detail-view/view.ts |
| 2401 | ✅ | Application/DetailView | DetailView ViewModel mit State-Management | hoch | Ja | #2400 | DetailView.md#state-synchronisation, Application.md#viewmodel-pattern | src/application/detail-view/viewmodel.ts |
| 2402 | ✅ | Application/DetailView | Tab-Management (activeTab State, setActiveTab) | hoch | Ja | #2401 | DetailView.md#uebersicht | viewmodel.ts:setActiveTab(), types.ts:DetailViewState.activeTab |
| 2403 | ✅ | Application/DetailView | Idle-State Placeholder (Hinweis wenn kein Tab aktiv) | mittel | Ja | #2400 | DetailView.md#idle-state-kein-tab-aktiv | view.ts:idleState (lines 113-123) |
| 2404 | ✅ | Application/DetailView | Auto-Open Verhalten für Encounter-Tab (encounter:generated) | hoch | Ja | #220, #2401 | DetailView.md#auto-open-verhalten, Encounter-System.md#events, Events-Catalog.md#encounter | viewmodel.ts:ENCOUNTER_GENERATED handler (lines 110-125) |
| 2405 | ✅ | Application/DetailView | Auto-Open Verhalten für Combat-Tab (combat:started) | hoch | Ja | #322, #2401 | DetailView.md#auto-open-verhalten, Combat-System.md#combat-flow, Events-Catalog.md#combat | viewmodel.ts:COMBAT_STARTED handler (lines 140-150) |
| 2406 | ⛔ | Application/DetailView | Auto-Open Verhalten für Location-Tab (ui:tile-selected, optional) | niedrig | Nein | #2401, #2448 | DetailView.md#auto-open-verhalten | viewmodel.ts:setupEventHandlers() [ändern - UI_TILE_SELECTED handler] |
| 2407 | ✅ | Application/DetailView | Tab-Priorität System (Combat > Encounter > Rest) | mittel | Ja | #2402 | DetailView.md#auto-open-verhalten | viewmodel.ts:ENCOUNTER_GENERATED handler (line 118 - prüft ob combat aktiv) |
| 2408 | ✅ | Application/DetailView | Encounter-Tab Component (Container) | hoch | Ja | - | DetailView.md#encounter-tab | src/application/detail-view/panels/encounter-tab.ts:createEncounterTab() |
| 2409 | 📋 | Application/DetailView | Encounter-Builder State (Name, Activity, Goal, Creatures) | hoch | Ja | #2401 | DetailView.md#encounter-tab, Encounter-System.md#schemas | types.ts:EncounterTabState, types.ts:BuilderCreature, viewmodel.ts:setBuilder*(), viewmodel.ts:*CreatureFromBuilder() |
| 2410 | ⛔ | Application/DetailView | Encounter-Suche (Autocomplete für gespeicherte EncounterDefinitions) | mittel | Ja | #2408, #2409 | DetailView.md#encounter-tab, Encounter-System.md#schemas | encounter-tab.ts [ändern - Suche-Input + Autocomplete-Logic] |
| 2411 | ⛔ | Application/DetailView | Kreatur/NPC-Suche (Autocomplete für CreatureDefinitions + Named NPCs) | hoch | Ja | #2408, #2409 | DetailView.md#encounter-tab, Creature.md#schema, NPC-System.md#npc-schema | encounter-tab.ts [ändern - Kreatur-Suche-Input + Autocomplete-Logic] |
| 2412 | ⛔ | Application/DetailView | Kreatur/NPC hinzufügen zum Builder | hoch | Ja | #2409, #2411 | DetailView.md#encounter-tab, DetailView.md#flow-neues-encounter-im-builder-erstellen | encounter-tab.ts [ändern - onAddCreature callback], viewmodel.ts [ändern - addCreatureToBuilder()] |
| 2413 | ⛔ | Application/DetailView | Kreatur/NPC entfernen aus Builder ([×] Button) | mittel | Ja | #2409, #2412 | DetailView.md#encounter-tab | encounter-tab.ts [ändern - Remove-Button], viewmodel.ts [ändern - removeCreatureFromBuilder()] |
| 2414 | ⛔ | Application/DetailView | Encounter-Wertung Live-Berechnung (Gesamt-XP, Difficulty, Daily-Budget) | hoch | Ja | #2409, #1400 | DetailView.md#encounter-tab, Encounter-Balancing.md#xp-budget, Encounter-Balancing.md#cr-vergleich | viewmodel.ts [ändern - calculateEncounterRating()], nutzet Encounter-Balancing-Feature #1400 |
| 2415 | ✅ | Application/DetailView | Encounter-Builder befüllen aus encounter:generated Event | hoch | Ja | #2404, #2409 | DetailView.md#encounter-tab, DetailView.md#flow-random-encounter-builder, Encounter-System.md#events | viewmodel.ts:loadEncounterIntoBuilder(), ENCOUNTER_GENERATED handler |
| 2416 | ⛔ | Application/DetailView | Encounter-Builder befüllen aus gespeichertem Encounter | mittel | Ja | #2409, #2410 | DetailView.md#flow-gespeichertes-encounter-laden, Encounter-System.md#schemas | viewmodel.ts [ändern - loadEncounterDefinition()], encounter-tab.ts [ändern - onLoadEncounter callback] |
| 2417 | ⛔ | Application/DetailView | Encounter speichern (💾 Button) | mittel | Ja | #2409 | DetailView.md#flow-builder-speichern, Encounter-System.md#schemas | encounter-tab.ts [ändern - Save-Button], viewmodel.ts [ändern - saveEncounterDefinition()], view.ts [ändern - onSaveEncounter callback] |
| 2418 | ✅ | Application/DetailView | Combat starten aus Builder (⚔️ Button, publiziert combat:start-requested) | hoch | Ja | #321, #2409 | DetailView.md#flow-builder-combat, Combat-System.md#combat-flow, Encounter-System.md#integration | encounter-tab.ts:onStartEncounter → view.ts:EventTypes.ENCOUNTER_START_REQUESTED (lines 236-244) |
| 2419 | ✅ | Application/DetailView | Combat-Tab Component (Container) | hoch | Ja | #305, #2400 | DetailView.md#combat-tab, Combat-System.md#schemas | src/application/detail-view/panels/combat-tab.ts |
| 2420 | ✅ | Application/DetailView | Combat-Tab State (CombatState, PendingEffects, Resolution) | hoch | Ja | #2401, #2419 | DetailView.md#combat-tab, DetailView.md#state-synchronisation, Combat-System.md#combatstate | types.ts:CombatTabState, ResolutionState |
| 2421 | ✅ | Application/DetailView | Initiative-Tracker Display (Liste mit Reihenfolge, aktiver Participant markiert) | hoch | Ja | #2419, #2420 | DetailView.md#combat-tab, Combat-System.md#sortierung, Combat-System.md#initiative-layout | combat-tab.ts:renderParticipant(), renderInitiativeList() |
| 2422 | ✅ | Application/DetailView | HP-Bar Display pro Participant | hoch | Ja | #308, #309, #2420, #2421 | DetailView.md#combat-tab, Combat-System.md#damage-heal | combat-tab.ts:createHpBar() (lines 265-298) |
| 2423 | ✅ | Application/DetailView | Conditions Display pro Participant (Icons + Labels) | hoch | Ja | #312, #313, #2420, #2421 | DetailView.md#combat-tab, Combat-System.md#conditions | combat-tab.ts:conditions rendering (lines 220-246) |
| 2424 | ✅ | Application/DetailView | Damage Button + Dialog | hoch | Ja | #319, #2419, #2420 | DetailView.md#combat-tab, Combat-System.md#combat-flow, Combat-System.md#automatische-effekte | combat-tab.ts:damageBtn + view.ts:onApplyDamage callback (lines 288-295) |
| 2425 | ✅ | Application/DetailView | Heal Button + Dialog | hoch | Ja | #2419, #2424 | DetailView.md#combat-tab, Combat-System.md#start-of-turn | combat-tab.ts:healBtn + view.ts:onApplyHealing callback (lines 297-305) |
| 2426 | ✅ | Application/DetailView | Condition Button + Dropdown | hoch | Ja | #2419, #2424 | DetailView.md#combat-tab, Combat-System.md#end-of-turn | combat-tab.ts:conditionBtn + view.ts:onAddCondition/onRemoveCondition callbacks (lines 306-323) |
| 2427 | ⬜ | Application/DetailView | Add Effect Button + Dialog (Custom Start/End-of-Turn Effects) | mittel | Nein | #323, #2419, #2420 | DetailView.md#flow-combat-beenden, Combat-System.md#combat-flow | combat-tab.ts [ändern - Effect-Button + Dialog], view.ts [ändern - onAddEffect callback] |
| 2428 | ✅ | Application/DetailView | Next Turn Button (combat:next-turn-requested) | hoch | Ja | #338, #339, #340, #2419, #2427 | DetailView.md#post-combat-resolution, Combat-System.md#post-combat-resolution, Combat-System.md#xp-berechnung | combat-tab.ts:nextTurnBtn + view.ts:onNextTurn callback (lines 274-277) |
| 2429 | ✅ | Application/DetailView | End Combat Button (combat:end-requested) | hoch | Ja | #2419, #2428 | DetailView.md#post-combat-resolution, Combat-System.md#xp-berechnung | combat-tab.ts:endBtn + view.ts:onEndCombat callback (lines 279-287) |
| 2430 | ⛔ | Application/DetailView | Start-of-Turn Effect Display (Save-Prompt für Effekte wie Tasha's Caustic Brew) | mittel | Nein | #408, #409, #2420, #2427, #2428 | DetailView.md#post-combat-resolution, Quest-System.md#quest-assignment-ui-post-combat, Quest-System.md#40-60-split-mechanik, Combat-System.md#post-combat-resolution | combat-tab.ts [ändern - Turn-Wechsel-Dialog mit Pending-Effects], viewmodel.ts [ändern - getPendingEffects()] |
| 2431 | ✅ | Application/DetailView | Post-Combat Resolution State-Management | hoch | Ja | - | DetailView.md#post-combat-resolution, Loot-Feature.md#verteilen-einheitliches-loot-modal, Loot-Feature.md#loot-generierung-bei-encounter, Combat-System.md#post-combat-resolution | types.ts:CombatTabState [ändern - Resolution-Felder hinzufügen], viewmodel.ts [ändern - Resolution-State-Management] |
| 2432 | ⬜ | Application/DetailView | Post-Combat Phase 1: XP-Summary Display (Basis-XP, GM-Anpassung, Verteilung) | hoch | Ja | - | DetailView.md#shop-tab, Shop.md#verwendung | combat-tab.ts [neu - renderResolutionPanel:XpPhase] |
| 2433 | ⛔ | Application/DetailView | Post-Combat Phase 1: GM-Anpassung Controls ([-] [%] [+] Schnellauswahl) | mittel | Ja | #2432 | DetailView.md#shop-tab, DetailView.md#state-synchronisation, Shop.md#schema | combat-tab.ts:XpPhase [ändern - GM-Modifier-Controls] |
| 2434 | ⛔ | Application/DetailView | Post-Combat Phase 2: Quest-Zuweisung Display (Quest-Suche, Aktive Quests Radio-Liste) | hoch | Ja | #2432, #2433 | DetailView.md#shop-tab, Shop.md#queries | combat-tab.ts [neu - renderResolutionPanel:QuestPhase] |
| 2435 | ⛔ | Application/DetailView | Post-Combat Phase 2: Quest-Pool XP Zuweisung (Quest auswählen, XP zuweisen) | hoch | Ja | #2433, #2434 | DetailView.md#shop-tab, Shop.md#preis-berechnung, Shop.md#events | viewmodel.ts [ändern - assignXpToQuest()], view.ts [ändern - onAssignQuestXp callback] |
| 2436 | ⛔ | Application/DetailView | Post-Combat Phase 3: Loot-Verteilung Display (Items + Gold) | hoch | Ja | #2433, #2434 | DetailView.md#shop-tab, Shop.md#preis-berechnung, Shop.md#events | combat-tab.ts [neu - renderResolutionPanel:LootPhase] |
| 2437 | ⛔ | Application/DetailView | Post-Combat Phase 3: Item-Verteilung (Dropdown pro Item → Character) | hoch | Ja | #2400, #2436 | DetailView.md#location-tab, POI.md#tile-content-panel | combat-tab.ts:LootPhase [ändern - Item-Dropdown-Controls] |
| 2438 | ⛔ | Application/DetailView | Post-Combat Phase 3: Gold-Verteilung (Gleichmäßig verteilen + manuell anpassen) | mittel | Ja | #2436, #2437 | DetailView.md#location-tab, DetailView.md#state-synchronisation, POI.md#queries | combat-tab.ts:LootPhase [ändern - Gold-Distribution-Controls] |
| 2439 | ⛔ | Application/DetailView | Post-Combat Resolution: Überspringen-Button pro Phase | mittel | Ja | #2431, #2432, #2434, #2436, #2438 | DetailView.md#location-tab, Terrain.md#schema, Weather-System.md#weather-state | combat-tab.ts:renderResolutionPanel [ändern - Skip-Button], viewmodel.ts [ändern - skipPhase()] |
| 2440 | ⛔ | Application/DetailView | Post-Combat Resolution: Weiter-Button (Phase-Transition) | hoch | Ja | #2431, #2432, #2438 | DetailView.md#location-tab, POI.md#tile-content-panel, POI.md#queries | combat-tab.ts:renderResolutionPanel [ändern - Next-Button], viewmodel.ts [ändern - nextPhase()] |
| 2441 | ⛔ | Application/DetailView | Post-Combat Resolution: Events publizieren (encounter:resolved, quest:xp-accumulated, loot:distributed) | hoch | Ja | #2431, #2435, #2437, #2438 | DetailView.md#location-tab, Faction.md#praesenz-datenstruktur, Faction.md#encounter-integration | viewmodel.ts [ändern - Resolution-Event-Publishing], view.ts [ändern - Event-Callbacks] |
| 2442 | ⛔ | Application/DetailView | Shop-Tab Component (Container) | mittel | Ja | #2400, #2438 | DetailView.md#location-tab, NPC-System.md#npc-schema, NPC-System.md#mvp-fraktions-basierte-location | [neu] src/application/detail-view/panels/shop-tab.ts |
| 2443 | ⬜ | Application/DetailView | Shop-Tab State (activeShop, searchQuery, filter, mode) | mittel | Ja | #2400, #2401 | DetailView.md#quest-tab, Quest.md#schema | types.ts:ShopTabState [neu], viewmodel.ts [ändern - Shop-State-Management] |
| 2444 | ⛔ | Application/DetailView | Shop-Tab Buy-Mode (Item-Liste, Search, Filter, Buy-Button) | mittel | Ja | #2442, #2443 | DetailView.md#quest-tab, DetailView.md#state-synchronisation, Quest-System.md#quest-progress-runtime-state | shop-tab.ts [ändern - Buy-Mode-Rendering] |
| 2445 | ⛔ | Application/DetailView | Shop-Tab Sell-Mode (Party-Inventory, Sell-Button) | mittel | Ja | #2442, #2443, #2444 | DetailView.md#quest-tab, Quest-System.md#quest-schema-entityregistry, Quest.md#questobjective | shop-tab.ts [ändern - Sell-Mode-Rendering] |
| 2446 | ⛔ | Application/DetailView | Shop-Tab Mode Toggle (Buy/Sell wechseln) | niedrig | Nein | #2442, #2443, #2444 | DetailView.md#quest-tab, Quest-System.md#quest-state-machine, Quest.md#events | shop-tab.ts [ändern - Mode-Toggle-Button], viewmodel.ts [ändern - toggleShopMode()] |
| 2447 | ⛔ | Application/DetailView | Shop-Tab Load More / Pagination | niedrig | Nein | #2400, #2444 | DetailView.md#journal-tab, Journal.md#schema | shop-tab.ts [ändern - Pagination-Controls] |
| 2448 | ⛔ | Application/DetailView | Location-Tab Component (Container) | mittel | Ja | #2400, #2447 | DetailView.md#journal-tab, DetailView.md#state-synchronisation, Journal.md#queries | [neu] src/application/detail-view/panels/location-tab.ts |
| 2449 | ⛔ | Application/DetailView | Location-Tab State (selectedTile, tileData) | mittel | Ja | #2401, #2448 | DetailView.md#journal-tab, Journal.md#schema | types.ts:LocationTabState [neu], viewmodel.ts [ändern - Location-State-Management] |
| 2450 | ⛔ | Application/DetailView | Location-Tab Terrain Display (Type, Elevation, Movement Cost) | mittel | Ja | #2448, #2449 | DetailView.md#journal-tab, Journal.md#journalentry | location-tab.ts [ändern - Terrain-Rendering] |
| 2429a | ✅ | Application/DetailView | Update Initiative Button (combat:update-initiative-requested) | mittel | Ja | #2419, #2428 | DetailView.md#post-combat-resolution, Combat-System.md#xp-berechnung | combat-tab.ts:initBtn + view.ts:onUpdateInitiative callback (lines 324-332) |
| 2451 | ⛔ | Application/DetailView | Location-Tab Weather Display (aktuelles Wetter für Tile) | mittel | Ja | #2448, #2449 | DetailView.md#location-tab | location-tab.ts [ändern - Weather-Rendering] |
| 2452 | ⛔ | Application/DetailView | Location-Tab POI-Liste (POIs auf Tile mit Details-Link) | mittel | Ja | #2448, #2449 | DetailView.md#location-tab | location-tab.ts [ändern - POI-List-Rendering] |
| 2453 | ⛔ | Application/DetailView | Location-Tab Fraktions-Präsenz (Factions mit %-Werten) | niedrig | Nein | #2448, #2449 | DetailView.md#location-tab | location-tab.ts [ändern - Faction-Rendering] |
| 2454 | ⛔ | Application/DetailView | Location-Tab Bekannte NPCs (NPCs auf Tile) | niedrig | Nein | #2448, #2449 | DetailView.md#location-tab | location-tab.ts [ändern - NPC-List-Rendering] |
| 2455 | ⬜ | Application/DetailView | Quest-Tab Component (Container) | niedrig | Nein | #2400 | DetailView.md#quest-tab | [neu] src/application/detail-view/panels/quest-tab.ts |
| 2456 | ⬜ | Application/DetailView | Quest-Tab State (selectedQuest) | niedrig | Nein | #2401 | DetailView.md#viewmodel-state | types.ts:QuestTabState [neu], viewmodel.ts [ändern - Quest-State-Management] |
| 2457 | ⛔ | Application/DetailView | Quest-Tab Details Display (Status, Progress, Description, Objectives) | niedrig | Nein | #2455, #2456 | DetailView.md#quest-tab | quest-tab.ts [ändern - Quest-Details-Rendering] |
| 2458 | ⛔ | Application/DetailView | Quest-Tab Encounters Display (Liste mit XP-Info, Start-Button) | niedrig | Nein | #2455, #2456 | DetailView.md#quest-tab | quest-tab.ts [ändern - Encounter-List-Rendering] |
| 2459 | ⛔ | Application/DetailView | Quest-Tab Rewards Display (Gold, Quest-XP Pool, Reputation) | niedrig | Nein | #2455, #2456 | DetailView.md#quest-tab | quest-tab.ts [ändern - Rewards-Rendering] |
| 2460 | ⛔ | Application/DetailView | Quest-Tab Complete/Abandon Buttons | niedrig | Nein | #2455 | DetailView.md#quest-tab | quest-tab.ts [ändern - Action-Buttons], viewmodel.ts [ändern - completeQuest()/abandonQuest()], view.ts [ändern - Quest-Callbacks] |
| 2461 | ⬜ | Application/DetailView | Journal-Tab Component (Container) | niedrig | Nein | #2400 | DetailView.md#journal-tab | [neu] src/application/detail-view/panels/journal-tab.ts |
| 2462 | ⬜ | Application/DetailView | Journal-Tab State (filter, entries) | niedrig | Nein | #2401 | DetailView.md#viewmodel-state | types.ts:JournalTabState [neu], viewmodel.ts [ändern - Journal-State-Management] |
| 2463 | ⛔ | Application/DetailView | Journal-Tab Filter Controls (Type-Filter, Date-Filter) | niedrig | Nein | #2461, #2462 | DetailView.md#journal-tab | journal-tab.ts [ändern - Filter-Controls] |
| 2464 | ⛔ | Application/DetailView | Journal-Tab Entry Display (Chronologisch gruppiert nach Tag) | niedrig | Nein | #2461, #2462 | DetailView.md#journal-tab | journal-tab.ts [ändern - Entry-Rendering] |
| 2465 | ⛔ | Application/DetailView | Journal-Tab Quick Note Button | niedrig | Nein | #2461 | DetailView.md#journal-tab | journal-tab.ts [ändern - Quick-Note-Button], viewmodel.ts [ändern - addQuickNote()], view.ts [ändern - onAddQuickNote callback] |
| 2466 | ⛔ | Application/DetailView | Journal-Tab Export Button | niedrig | Nein | #2461 | DetailView.md#journal-tab | journal-tab.ts [ändern - Export-Button], viewmodel.ts [ändern - exportJournal()] |
| 2467 | ⬜ | Application/DetailView | Keyboard-Shortcuts (1-6 für Tab-Wechsel, Escape für Close) | niedrig | Nein | #2402 | DetailView.md#keyboard-shortcuts | view.ts [ändern - onKeyDown handler mit Tab-Switch-Logic] |
| 2468 | ⬜ | Application/DetailView | Keyboard-Shortcuts Combat-spezifisch (N=Next Turn, D=Damage, H=Heal) | niedrig | Nein | #2419 | DetailView.md#keyboard-shortcuts | view.ts [ändern - onKeyDown handler mit Combat-Shortcuts], combat-tab.ts [ändern - keyboard event passthrough] |
| 2469 | ✅ | Application/DetailView | Event-Subscriptions Setup (encounter:generated, combat:started, etc.) | hoch | Ja | #2401 | DetailView.md#event-subscriptions | viewmodel.ts:setupEventHandlers() (lines 109-173) |
| 2470 | ⬜ | Application/DetailView | Generate-Button im Encounter-Tab (🎲, publiziert encounter:generate-requested) | hoch | Ja | #2408, #215 | DetailView.md#encounter-tab | encounter-tab.ts [ändern - Generate-Button + Handler] |
| 2970 | ⛔ | Application/DetailView | Situation-Sektion im Encounter-Tab: Activity + Disposition Anzeige | hoch | Ja | #2409 | DetailView.md#encounter-tab | - |
| 2971 | ⛔ | Application/DetailView | Detection-Sektion im Encounter-Tab: Methode, Distanz, Awareness | hoch | Ja | #2409, #208 | DetailView.md#encounter-tab | - |
| 3021 | ⛔ | DetailView | Attrition-Feedback Banner nach Combat | niedrig | Nein | #3018 | DetailView.md#post-combat-resolution, Faction.md#ui-feedback | - |

---

*Siehe auch: [SessionRunner.md](SessionRunner.md) | [Combat-System.md](../features/Combat-System.md) | [Encounter-System.md](../features/Encounter-System.md) | [Shop.md](../domain/Shop.md)*
