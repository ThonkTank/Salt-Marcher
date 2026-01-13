# EncounterRunner

> **Verantwortlichkeit:** Session-View fuer aktive Encounters aller Typen (Combat, Chase, Social).
> **Store:** `encounterRunnerStore` (aus `src/application/encounterRunner/`)
> **Workflow:** `encounterRunnerWorkflow` (aus `src/workflows/`)

**Pfad:** `src/views/EncounterRunner/`

---

## Uebersicht

Der EncounterRunner ist der **zentrale View fuer aktive Encounters** waehrend einer Session:

| Tab | Beschreibung | Spec |
|-----|--------------|------|
| **Combat** | Initiative-Tracker, Grid, HP-Management, AI-Vorschlaege | [CombatTab.md](EncounterRunner/CombatTab.md) |
| **Chase** | Chase-Mechanik mit Komplikationen und Distanz-Tracking | [ChaseTab.md](EncounterRunner/ChaseTab.md) |
| **Social** | Disposition-Tracking, NPC-Reaktionen, Skill-Challenges | [SocialTab.md](EncounterRunner/SocialTab.md) |

**Trigger:** Wird automatisch geoeffnet wenn ein Encounter gestartet wird (`encounter:started` Event).

---

## Layout-Wireframe (3 Spalten)

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│                     │                     │                     │
│   Map (Grid)        │   [Combat][Chase]   │   Detail View       │
│                     │   [Social]          │                     │
│   ┌───────────┐     │                     │   Statblock:        │
│   │ G │   │   │     │   Control Panel     │   Name, HP, AC      │
│   │   │ P │   │     │   [Roll] [Std]      │   Actions           │
│   │   │   │   │     │   [Accept] [Skip]   │   Traits            │
│   └───────────┘     │                     │   Conditions        │
│                     │   Initiative:       │                     │
│   [Action Overlay]  │   > Goblin 12/12    │   --- oder ---      │
│                     │     Player 25/25    │                     │
│                     │                     │   NPC-Info:         │
│                     │   Encounter Log:    │   Disposition       │
│                     │   Round 1           │   Personality       │
│                     │   > Attack -> Hit   │   Goals             │
│                     │                     │                     │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

**Spalten-Beschreibung:**

| Spalte | Inhalt | Breite |
|--------|--------|--------|
| **Map** | Grid-Canvas mit Tokens (shared) | Flex (min 300px) |
| **Control** | Tab-Navigation, Controls, Log | 280px |
| **Detail** | Statblock oder NPC-Info | 300px |

---

## Komponenten-Architektur

```
src/views/
├── shared/                          # Wiederverwendbare Komponenten
│   ├── GridCanvas.svelte            # Canvas mit Grid + Tokens
│   └── TokenOverlay.svelte          # Action-Overlay ueber Token
│
└── EncounterRunner/
    ├── EncounterRunnerView.ts       # Obsidian ItemView (mount/unmount)
    ├── EncounterRunner.svelte       # Root-Container (3-Spalten-Layout)
    ├── tabs/
    │   ├── CombatTab.svelte         # Combat-spezifische Controls
    │   ├── ChaseTab.svelte          # Chase-spezifische Controls
    │   └── SocialTab.svelte         # Social-spezifische Controls
    └── components/
        ├── TabNavigation.svelte     # Tab-Switcher
        ├── InitiativeList.svelte    # Turn-Order (Combat)
        ├── ChaseTracker.svelte      # Distanz + Komplikationen (Chase)
        ├── DispositionMeter.svelte  # Disposition-Anzeige (Social)
        ├── EncounterLog.svelte      # Protocol-Ausgabe
        └── DetailPanel.svelte       # Statblock oder NPC-Info
```

---

## Tab-Dokumentation

Detaillierte Spezifikationen fuer jeden Tab:

- **[CombatTab](EncounterRunner/CombatTab.md)** - Initiative, Grid, AI-Vorschlaege, HP-Management
- **[ChaseTab](EncounterRunner/ChaseTab.md)** - Zonen, Komplikationen, Dash-Mechanik
- **[SocialTab](EncounterRunner/SocialTab.md)** - Disposition, Skill-Challenges, NPC-Reaktionen

---

## Shared-Komponenten

View-uebergreifende Komponenten: **[shared.md](shared.md)**

| Komponente | Beschreibung |
|------------|--------------|
| **GridCanvas** | Square-Grid Rendering mit Tokens |
| **TokenOverlay** | Action-Info Overlay |

---

## Application Control

**Datei:** `src/application/encounterRunner/encounterRunnerControl.ts`

### State

```typescript
export interface EncounterRunnerUIState {
  // Aktiver Tab
  activeTab: 'combat' | 'chase' | 'social';

  // Tab-spezifischer State
  combat: CombatTabState | null;
  chase: ChaseTabState | null;
  social: SocialTabState | null;

  // UI State
  selectedEntityId: string | null;  // Fuer Detail-View

  // Error
  error: string | null;
}
```

### Store

```typescript
export const encounterRunnerStore: Writable<EncounterRunnerUIState>;
```

### Actions

| Funktion | Beschreibung |
|----------|--------------|
| `initEncounterRunner()` | Initialisiert Store |
| `switchTab(tab)` | Wechselt aktiven Tab |
| `selectEntity(id)` | Waehlt Entity fuer Detail-View |
| `startCombat(encounter)` | Startet Combat-Encounter |
| `startChase(chase)` | Startet Chase-Encounter |
| `startSocial(social)` | Startet Social-Encounter |
| `endEncounter()` | Beendet aktuellen Encounter |

---

## Workflow

**Datei:** `src/workflows/encounterRunnerWorkflow.ts`

### Funktionen

| Funktion | Beschreibung |
|----------|--------------|
| `initializeEncounter(type, data)` | Initialisiert Encounter nach Typ |
| `advanceTurn()` | Naechster Turn (Combat/Chase) |
| `executeAction(action)` | Fuehrt Aktion aus |
| `resolveSkillCheck(skill, dc)` | Wuerfelt Skill-Check (Social) |
| `updateDisposition(delta)` | Aendert Disposition (Social) |
| `endEncounter()` | Beendet und resolved Encounter |

---

## Datenfluss

### Flow: Encounter starten

```
SessionRunner: encounter:generated Event
    |
    v
encounterRunnerControl.startCombat/Chase/Social(data)
    |
    v
encounterRunnerWorkflow.initializeEncounter(type, data)
    |
    v
EncounterRunner View oeffnet sich
    |
    v
activeTab wird gesetzt (combat/chase/social)
    |
    v
UI rendert entsprechenden Tab
```

### Flow: Tab wechseln

```
User klickt Tab
    |
    v
TabNavigation.onClick(tab)
    |
    v
encounterRunnerControl.switchTab(tab)
    |
    v
encounterRunnerStore.update({ activeTab: tab })
    |
    v
UI rendert neuen Tab
```

### Flow: Entity selektieren

```
User klickt Token/Listeneintrag
    |
    v
GridCanvas.onEntityClick(id) / InitiativeList.onClick(id)
    |
    v
encounterRunnerControl.selectEntity(id)
    |
    v
encounterRunnerStore.update({ selectedEntityId: id })
    |
    v
DetailPanel zeigt Statblock/NPC-Info
```

---

## Integration mit SessionRunner

Der EncounterRunner ist ein **Companion-View** zum SessionRunner:

| Aspekt | SessionRunner | EncounterRunner |
|--------|---------------|-----------------|
| **Fokus** | Overworld, Travel, Zeit | Aktive Encounters |
| **Map** | Hex-Grid | Square-Grid (Combat) |
| **State** | sessionState | encounterState |
| **Trigger** | Manuell | encounter:started |

**Auto-Open:** EncounterRunner oeffnet automatisch bei `encounter:started`, schliesst bei `encounter:resolved`.

---

## Keyboard-Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `1` | Combat-Tab |
| `2` | Chase-Tab |
| `3` | Social-Tab |
| `N` | Next Turn (Combat/Chase) |
| `A` | Accept AI Action (Combat) |
| `S` | Skip Turn |
| `Escape` | End Encounter (Bestaetigung) |

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/views/shared/GridCanvas.svelte` | Grid + Token Rendering (shared) |
| `src/views/shared/TokenOverlay.svelte` | Action-Overlay (shared) |
| `src/views/EncounterRunner/EncounterRunnerView.ts` | Obsidian ItemView |
| `src/views/EncounterRunner/EncounterRunner.svelte` | Root-Container |
| `src/views/EncounterRunner/tabs/*.svelte` | Tab-Komponenten |
| `src/views/EncounterRunner/components/*.svelte` | Shared Komponenten |
| `src/application/encounterRunner/encounterRunnerControl.ts` | Store + Actions |
| `src/workflows/encounterRunnerWorkflow.ts` | Business Logic |

---

*Siehe auch: [SessionRunner](SessionRunner.md) | [DetailView](DetailView.md) | [shared](shared.md) | [Orchestration](../architecture/Orchestration.md)*
