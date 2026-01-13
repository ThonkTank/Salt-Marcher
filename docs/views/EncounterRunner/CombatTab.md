# Combat Tab

> **Parent:** [EncounterRunner](../EncounterRunner.md)
> **Verantwortlichkeit:** Initiative-Tracker, Grid-basiertes Combat, HP-Management, AI-Vorschlaege.
>
> **Referenzierte Schemas:**
> - [combat.ts](../../../src/types/combat.ts) - Combatant, CombatState
> - [action.md](../../types/action.md) - Action-Schema
>
> **Verwandte Services:**
> - [combatTracking.md](../../services/combatTracking.md) - State-Management, Action-Resolution
> - [combatantAI.md](../../services/combatantAI/combatantAI.md) - AI-Entscheidungslogik

**Pfad:** `src/views/EncounterRunner/tabs/CombatTab.svelte`

---

## Uebersicht

Der Combat-Tab ist der primaere Tab fuer D&D 5e Kaempfe:

| Funktion | Beschreibung |
|----------|--------------|
| **Initiative-Tracking** | Turn-Order mit HP-Anzeige |
| **Grid-Visualisierung** | Token-Positionen, Bewegungspfade, Terrain |
| **AI-Vorschlaege** | Berechnete Aktionen fuer alle Combatants |
| **Manuelle Steuerung** | Drag/Drop, Aktion-Auswahl, Ziel-Klick |
| **Reactions** | Automatische Trigger mit Prompt |
| **Concentration** | Tracking mit automatischen Checks |

---

## Layout (innerhalb EncounterRunner)

```
+---------------------+---------------------+---------------------+
|                     |                     |                     |
|   Map (Grid)        |   [Combat] Chase    |   Detail View       |
|                     |    Social           |                     |
|   +-------------+   |                     |   Statblock:        |
|   | G |   |   |   |   [Roll] [Std]      |   Name, HP, AC      |
|   |   | P |   |   |   [Accept] [Skip]   |   Actions (klickbar)|
|   |   |   |   |   |                     |   Traits            |
|   +-------------+   |   Initiative:       |   Conditions        |
|                     |   > Goblin 12/12    |                     |
|   [Drag/Drop]       |     Player 25/25    |   [Wuerfeln]        |
|   [Action Overlay]  |                     |   [Ergebnis]        |
|                     |   Combat Log:       |                     |
|                     |   Round 1           |                     |
|                     |   > Attack -> Hit   |                     |
|                     |                     |                     |
+---------------------+---------------------+---------------------+
```

---

## AI-System

### Grundprinzip

Die AI berechnet optimale Zuege fuer **alle Combatants** (NPCs und Spieler). Alle Vorschlaege sind optional - der GM hat volle Kontrolle.

| Aspekt | Verhalten |
|--------|-----------|
| **Scope** | NPCs + Spieler-Charaktere |
| **Verbindlichkeit** | Nur Vorschlaege, keine Pflicht |
| **Turn-Unterschied** | Kein Unterschied zwischen Player und NPC |

### AI-Vorschlag

Bei Turn-Start berechnet die AI die optimale Aktion und zeigt das ActionPanel beim Target-Token.

> **Service:** AI-Berechnung via [combatantAI](../../services/combatantAI/combatantAI.md)

---

## Manuelle Steuerung

Der GM kann jederzeit vom AI-Vorschlag abweichen:

### Token Drag/Drop

- Combatants per Drag/Drop auf der Map verschieben
- System zeigt Bewegungsreichweite (Movement-Zellen)
- Terrain-Kosten werden beruecksichtigt

### Aktion auswaehlen

1. **DetailView:** Aktion aus Liste anklicken
2. **Map:** Token als Ziel anklicken
3. **ActionPanel** erscheint beim Target

---

## ActionPanel

Einheitliches Panel fuer AI-Vorschlaege und manuelle Aktionen:

```
+----------------------------------+
| Shortbow                         |  <- Hover = Tooltip
| +4 vs AC 16  ·  1d6+2            |
+----------------------------------+
| ▸ Pack Tactics: Advantage        |  <- Hover = Tooltip
| ▸ Half Cover: +2 AC              |
+----------------------------------+
| [Roll]        [Enter Result]     |
+----------------------------------+
```

### Elemente

| Element | Beschreibung |
|---------|--------------|
| **Aktions-Name** | Hover zeigt Schema-generierte Beschreibung |
| **Roll-Info** | `+X vs AC Y` oder `DC X [Ability]` |
| **Damage** | Dice-Expression |
| **Modifikatoren** | Collapsible, Hover zeigt Detail-Erklaerung |
| **[Roll]** | Wuerfelt im Tool |
| **[Enter Result]** | Oeffnet Eingabe-Dialog fuer Tisch-Wuerfel |

### Trigger

| Situation | Panel erscheint |
|-----------|-----------------|
| **AI-Vorschlag** | Automatisch bei Turn-Start |
| **Manuelle Aktion** | Nach Aktion + Ziel Klick |

### Nicht enthalten

- Target-Name (Token ist highlighted)
- Accept-Button (Roll/Enter Result deckt alles ab)
- Separater Tooltip-Trigger [?] (Hover direkt ueber Namen)
- Score oder Modi-Unterscheidung
- Ueberschriften oder UI-Chrome

**Tooltip-System:** Siehe [Tooltip.md](../Tooltip.md).

---

## Resolution Popup (Unified)

**Komponente:** `src/views/shared/ResolutionPopup.svelte`

Alle Resolution-Dialoge (Action, Reaction, Concentration, Turn-Effekt) werden durch eine einheitliche, reaktive Komponente abgehandelt.

### ResolutionRequest-Typen

| Typ | Trigger | Beschreibung |
|-----|---------|--------------|
| `action` | [Roll] / [Enter Result] im ActionPanel | Angriff oder Saving Throw Resolution |
| `reaction` | Automatisch bei Trigger-Events | Shield, Counterspell, Opportunity Attack |
| `concentration` | Automatisch bei Damage | Constitution Save bei aktiver Concentration |
| `turnEffect` | Start/End of Turn | Save gegen laufende Effekte |

### Layout (Angriff)

### Layout (Angriff)

```
┌─────────────────────────────────────┐
│ Shortbow → Goblin                   │
├─────────────────────────────────────┤
│ Angriffswurf                        │
│ Gewuerfelt: [____] + 4 = ___        │
│                                     │
│ [Hit]  [Miss]  [Crit]               │
├─────────────────────────────────────┤
│ Schaden (bei Hit/Crit)              │
│ Gewuerfelt: [____] + 2 = ___        │
│                                     │
│ [Bestaetigen]                       │
└─────────────────────────────────────┘
```

### Layout (Saving Throw)

```
┌─────────────────────────────────────┐
│ Fireball → Goblin                   │
├─────────────────────────────────────┤
│ DEX Save DC 15                      │
│                                     │
│ [Save]  [Fail]                      │
├─────────────────────────────────────┤
│ Schaden                             │
│ Gewuerfelt: [____] = ___            │
│ (Bei Save: halber Schaden)          │
│                                     │
│ [Bestaetigen]                       │
└─────────────────────────────────────┘
```

### Varianten nach Trigger

| Button | Popup-Verhalten |
|--------|-----------------|
| **[Roll]** | System wuerfelt automatisch, zeigt Ergebnis, fragt Hit/Miss/Crit |
| **[Enter Result]** | Leere Eingabefelder, GM traegt Tisch-Wuerfel ein |

### Flow

1. **Angriffswurf eingeben/anzeigen** (oder Save-DC anzeigen)
2. **Hit/Miss/Crit auswaehlen** (bei Save: Save/Fail)
3. **Bei Treffer: Schaden eingeben/anzeigen**
4. **Bestaetigen** → HP-Update, Protocol-Eintrag

### Elemente

| Element | Beschreibung |
|---------|--------------|
| **Header** | Aktion → Ziel (hier erlaubt, nicht im ActionPanel) |
| **Wuerfel-Eingabe** | Nur gewuerfelte Zahl, Modifier wird addiert |
| **Result-Buttons** | Hit/Miss/Crit (Angriff) oder Save/Fail (Saving Throw) |
| **Schaden-Sektion** | Nur bei Hit/Crit oder Fail/Save sichtbar |
| **[Bestaetigen]** | Schliesst Popup, wendet Schaden an |

### Bei Crit

- Schaden-Dice werden verdoppelt (System zeigt angepasste Formel)
- Bei [Roll]: System wuerfelt automatisch mit doppelten Dice
- Bei [Enter Result]: GM traegt Crit-Schaden manuell ein

### Bei Save

- **[Save]:** Halber Schaden wird angewendet
- **[Fail]:** Voller Schaden wird angewendet
- Kein Eingabefeld fuer Save-Wurf (Target wuerfelt, GM waehlt nur Ergebnis)

### Aktionen ohne Wuerfeln

Aktionen wie Dash, Disengage, Dodge, Hide benoetigen **kein Resolution Popup**.

| Aktion | Verhalten |
|--------|-----------|
| **Dash** | Sofort anwenden, Movement verdoppelt |
| **Disengage** | Sofort anwenden, keine OAs |
| **Dodge** | Sofort anwenden, Condition setzen |
| **Hide** | Sofort anwenden (Stealth-Check optional) |

ActionPanel zeigt fuer diese Aktionen nur [Ausfuehren] statt [Roll]/[Enter Result].

---

## Wuerfel-Modi

Der GM kann zwischen zwei Modi waehlen:

| Modus | Beschreibung | Verwendung |
|-------|--------------|------------|
| **Im CombatTab wuerfeln** | System wuerfelt, zeigt Ergebnis | Schnelles Solo-Play |
| **Am Tisch wuerfeln** | GM traegt Ergebnis manuell ein | Tisch-Sessions |

### Ergebnis eintragen

```
+----------------------------------+
|  Angriff: Shortbow -> Thorin     |
|  --------------------------------|
|  Gewuerfelt: [  14  ] + 4 = 18   |
|  [Hit] [Miss] [Crit]              |
|  --------------------------------|
|  Bei Hit - Damage:                |
|  Gewuerfelt: [   5  ] + 2 = 7    |
|  [Bestaetigen]                    |
+----------------------------------+
```

---

## Reactions

Das System erkennt Reaction-Trigger automatisch und zeigt einen Prompt.

### Unterstuetzte Reactions

| Trigger | Beispiele |
|---------|-----------|
| **Angriff trifft** | Shield |
| **Spell wird gewirkt** | Counterspell |
| **Bewegung aus Reichweite** | Opportunity Attack |
| **Ally wird angegriffen** | Protection Fighting Style |

### Reaction-Prompt

```
+----------------------------------+
|  Reaction verfuegbar!            |
|  --------------------------------|
|  Goblin Mage wird angegriffen    |
|  (Thorin -> Longsword, 18 to hit)|
|  --------------------------------|
|  Shield verfuegbar               |
|  Effekt: +5 AC bis naechster Turn|
|  --------------------------------|
|  [Verwenden] [Ignorieren]         |
+----------------------------------+
```

> **Service:** Reaction-Processing via [combatTracking](../../services/combatTracking.md#reaction-processing)

---

## Concentration

### Anzeige

Concentrating-Combatants werden in der InitiativeList markiert:

```
> Elara        28/28 HP  [Concentrating: Haste]
```

### Concentration-Check

Bei Damage an einem Concentrating-Combatant erscheint ein Prompt:

```
+----------------------------------+
|  Concentration-Check             |
|  --------------------------------|
|  Elara konzentriert auf: Haste   |
|  Damage erhalten: 12             |
|  --------------------------------|
|  DC: 12 (max(10, damage/2))      |
|  CON Save Bonus: +3              |
|  --------------------------------|
|  [Save erfolgt] [Save fehlgeschlagen]
+----------------------------------+
```

Bei Fail: Concentration bricht automatisch, Spell-Effekt endet.

---

## Start/End-of-Turn Effekte

Bei Turn-Wechsel zeigt das System automatisch relevante Effekte.

### Start-of-Turn

```
+----------------------------------+
|  Goblin's Zug - Start-of-Turn    |
|  --------------------------------|
|  Tasha's Caustic Brew            |
|  Save: DC 13 DEX                  |
|  Bei Fail: 2d4 acid damage        |
|  Bei Success: Effekt endet        |
|  --------------------------------|
|  [Save erfolgt] [Save fehlgeschlagen]
+----------------------------------+
```

### End-of-Turn

```
+----------------------------------+
|  Thorin's Zug - End-of-Turn      |
|  --------------------------------|
|  Hold Person                      |
|  Save: DC 15 WIS                  |
|  Bei Success: Effekt endet        |
|  --------------------------------|
|  [Save erfolgt] [Save fehlgeschlagen] [Zug beenden]
+----------------------------------+
```

> **Details:** Vollstaendige Effekt-Mechanik in [Combat.md](../../features/Combat.md#automatische-effekte)

---

## Terrain-Integration

Das Grid zeigt Terrain visuell und die AI beruecksichtigt mechanische Effekte.

### Visuelle Darstellung

| Terrain | Darstellung |
|---------|-------------|
| **Difficult Terrain** | Schraffierte Zellen |
| **Cover (Half)** | Halbtransparentes Overlay |
| **Cover (3/4)** | Dunkleres Overlay |
| **Walls** | Solide Linien |
| **Hazards** | Farbiges Overlay (Rot fuer Lava, etc.) |

### Mechanische Effekte

| Effekt | Beschreibung |
|--------|--------------|
| **Movement-Kosten** | Difficult Terrain = 2x Kosten |
| **Cover** | +2 AC (Half) / +5 AC (3/4) |
| **Line of Sight** | Blocked durch Walls |
| **Pathfinding** | AI meidet Hazards, optimiert Route |

> **Service:** Terrain-Effekte via [combatTerrain](../../services/combatTerrain/)

---

## Komponenten

### CombatTab.svelte

**Pfad:** `src/views/EncounterRunner/tabs/CombatTab.svelte`

Container fuer Combat-spezifische UI-Elemente.

```typescript
interface CombatTabProps {
  combat: CombatState;
  suggestedAction: TurnAction | null;
  onAcceptAction: () => void;
  onSkipTurn: () => void;
  onEndCombat: () => void;
  onManualAction: (action: Action, targetId: string) => void;
  onTokenDrag: (combatantId: string, newPosition: GridPosition) => void;
}
```

### Shared-Komponenten

Verwendet view-uebergreifende Komponenten aus [shared.md](../shared.md):

| Komponente | Verwendung |
|------------|------------|
| **GridCanvas** | Grid + Token Rendering + Terrain |
| **TokenOverlay** | AI-Action Overlay |
| **TokenDrag** | Drag/Drop Bewegung |

### InitiativeList

**Pfad:** `src/views/EncounterRunner/components/InitiativeList.svelte`

```typescript
interface InitiativeListProps {
  combatants: Combatant[];
  turnOrder: string[];
  currentTurnIndex: number;
  selectedCombatantId: string | null;
  onSelectCombatant: (id: string) => void;
}
```

**Anzeige:**

```
> Goblin A     12/12 HP              <- Aktueller Turn
  Player       25/25 HP  [Haste]     <- Concentration
  Goblin B      8/12 HP  [Poisoned]  <- Condition
  Fighter       0/35 HP  [Downed]    <- Bei 0 HP
```

### CombatLog

**Pfad:** `src/views/EncounterRunner/components/CombatLog.svelte`

```typescript
interface CombatLogProps {
  protocol: CombatProtocolEntry[];
}
```

---

## Types

### TurnAction

AI-Vorschlag fuer einen Turn:

```typescript
interface TurnAction {
  combatantId: string;
  action: Action;
  targetId: string | null;
  targetPosition: GridPosition | null;  // Fuer AoE
  movementPath: GridPosition[];
  score: number;
  expectedDamage: number;
}
```

### CombatProtocolEntry

Eintrag im Combat-Log:

```typescript
interface CombatProtocolEntry {
  round: number;
  turnIndex: number;
  combatantId: string;
  type: 'action' | 'reaction' | 'effect' | 'damage' | 'heal' | 'condition';
  action?: Action;
  targetId?: string;
  roll?: { natural: number; total: number; type: 'attack' | 'save' | 'check' };
  result?: 'hit' | 'miss' | 'crit' | 'success' | 'fail';
  damage?: { amount: number; type: string };
  condition?: { type: string; added: boolean };
  description: string;
}
```

### Combatant

> **Definition:** [combat.ts](../../../src/types/combat.ts)

Combatant ist ein Union-Type von `NPCInCombat | CharacterInCombat`.

---

## Controls

### Vor Combat-Start

```
[Roll Init] [Std Init]
```

| Button | Beschreibung |
|--------|--------------|
| **Roll Init** | Wuerfelt d20 + DEX fuer alle |
| **Std Init** | Feste Werte (deterministische Tests) |

### Waehrend Combat

```
[Accept AI] [Skip] [End Combat]
```

| Button | Beschreibung |
|--------|--------------|
| **Accept AI** | Fuehrt AI-Vorschlag aus |
| **Skip** | Ueberspringt Turn ohne Aktion |
| **End Combat** | Beendet Combat, triggert Resolution |

---

## State

```typescript
interface CombatTabState {
  // Combat-Daten
  combatants: Combatant[];
  turnOrder: string[];
  currentTurnIndex: number;
  round: number;

  // AI
  suggestedAction: TurnAction | null;

  // UI
  initiativeMode: 'none' | 'rolling' | 'ready';
  selectedCombatantId: string | null;
  selectedAction: Action | null;

  // Unified Resolution (ersetzt separate Prompts)
  pendingResolution: ResolutionRequest | null;
}
```

### ResolutionRequest Union

```typescript
type ResolutionRequest =
  | { type: 'action'; action: Action; attacker: Combatant; target: Combatant; mode: 'roll' | 'enter' }
  | { type: 'reaction'; reaction: Action; owner: Combatant; trigger: string }
  | { type: 'concentration'; combatant: Combatant; spell: string; damage: number }
  | { type: 'turnEffect'; combatant: Combatant; timing: 'start' | 'end'; effect: EffectInfo };
```

---

## Datenfluss

### Flow: Combat starten

```
EncounterRunner empfaengt encounter:started (type: 'combat')
    |
    v
encounterRunnerControl.startCombat(encounterData)
    |
    v
CombatTab wird aktiv
    |
    v
User waehlt Initiative-Modus
    |
    v
Combat beginnt mit Round 1
```

### Flow: Turn ausfuehren (AI)

```
AI berechnet suggestedAction
    |
    v
TokenOverlay zeigt Vorschlag
    |
    v
User klickt [Accept AI]
    |
    v
encounterRunnerWorkflow.executeAction(suggestedAction)
    |
    v
Reaction-Check (Shield, Counterspell?)
    |
    +-- Reaction verfuegbar? --> Prompt anzeigen
    |
    v
CombatState aktualisiert (HP, Position, etc.)
    |
    v
Concentration-Check (falls Damage)
    |
    v
advanceTurn() -> naechster Combatant
    |
    v
End-of-Turn Effekte pruefen
    |
    v
Start-of-Turn Effekte pruefen (naechster)
    |
    v
AI berechnet neuen Vorschlag
```

### Flow: Turn ausfuehren (Manuell)

```
User waehlt Aktion im DetailView
    |
    v
User klickt Ziel-Token auf Map
    |
    v
Action-Info Popup erscheint
    |
    v
User wuerfelt (im Tool oder am Tisch)
    |
    v
User traegt Ergebnis ein / bestaetigt
    |
    v
encounterRunnerWorkflow.executeAction(manualAction)
    |
    v
(gleicher Flow wie AI ab Reaction-Check)
```

### Flow: Combat beenden

```
User klickt [End Combat]
    |
    v
encounterRunnerWorkflow.endCombat()
    |
    v
encounter:resolved Event
    |
    v
Post-Combat Resolution (XP, Loot, etc.)
```

> **Details:** Post-Combat Resolution in [Combat.md](../../features/Combat.md#post-combat-resolution)

---

## Initiative-Modi

### Roll Initiative

```typescript
for (const c of combat.combatants) {
  c.combatState.initiative = rollD20() + c.dexterityModifier;
}
sortTurnOrder(combat);
```

### Standard Initiative

- Basiert auf DEX-Modifier ohne Wuerfelwurf
- Ermoeglicht reproduzierbare Test-Ergebnisse

---

## Death Saves

**Entscheidung:** Nicht im Combat-Tracker.

Death Saves werden vom **Spieler selbst** getrackt. Der Combat-Tracker zeigt nur:
- HP: 0 = "Downed" Status in InitiativeList
- Spieler teilt GM mit wenn stabilisiert oder tot

> **Begruendung:** [Combat.md](../../features/Combat.md#death-saves)

---

## Keyboard-Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `A` | Accept AI Action |
| `S` | Skip Turn |
| `N` | Next Turn (nach manueller Aktion) |
| `R` | Roll Initiative (vor Combat) |
| `Escape` | Aktion abbrechen / Prompt schliessen |

---

## Dateien

### Shared Komponenten

| Datei | Beschreibung |
|-------|--------------|
| `src/views/shared/GridCanvas.svelte` | Grid + Tokens + Terrain |
| `src/views/shared/ActionPanel.svelte` | AI/Manuelle Aktion Panel |
| `src/views/shared/Tooltip.svelte` | Hover-Popup System |
| `src/views/shared/ResolutionPopup.svelte` | Unified Resolution Dialog (Action, Reaction, Concentration, TurnEffect) |
| `src/views/shared/types.ts` | Shared TypeScript Interfaces |
| `src/views/shared/tooltipHelpers.ts` | Schema-Generierung fuer Tooltips |

### EncounterRunner Komponenten

| Datei | Beschreibung |
|-------|--------------|
| `src/views/EncounterRunner/tabs/CombatTab.svelte` | Tab-Container |
| `src/views/EncounterRunner/components/InitiativeList.svelte` | Turn-Order |
| `src/views/EncounterRunner/components/CombatLog.svelte` | Protocol |

---

*Siehe auch: [EncounterRunner](../EncounterRunner.md) | [shared](../shared.md) | [ChaseTab](ChaseTab.md) | [SocialTab](SocialTab.md) | [Combat.md](../../features/Combat.md) | [combatTracking](../../services/combatTracking.md)*
