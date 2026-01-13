# Shared View-Komponenten

> **Verantwortlichkeit:** View-uebergreifende UI-Komponenten fuer Grid-Rendering und Token-Darstellung.

**Pfad:** `src/views/shared/`

---

## Uebersicht

Wiederverwendbare Komponenten fuer mehrere Views:

| Komponente | Beschreibung | Verwendet in |
|------------|--------------|--------------|
| **GridCanvas** | Square-Grid Rendering | Combat, Chase, Dungeon |
| **ActionPanel** | AI/Manuelle Aktion Panel | Combat |
| **ResolutionPopup** | Unified Resolution fuer Actions/Reactions/etc. | Combat |
| **[Tooltip](Tooltip.md)** | Hover-Popup System | Alle Views (eigenes Dokument) |

---

## GridCanvas

**Pfad:** `src/views/shared/GridCanvas.svelte`

Rendert ein Square-Grid mit Entities (Tokens, Markers) auf HTML Canvas.

### Props

```typescript
interface GridCanvasProps {
  // Grid-Konfiguration
  width: number;           // Grid-Breite in Zellen
  height: number;          // Grid-Hoehe in Zellen
  cellSize?: number;       // Pixel pro Zelle (default: 32)

  // Entities
  entities: GridEntity[];
  selectedEntityId: string | null;

  // Highlights
  highlightedCells?: GridPosition[];  // Bewegung, Reichweite
  targetedCells?: GridPosition[];     // Angriffsziele

  // Terrain (optional)
  terrain?: TerrainCell[];

  // Events
  onEntityClick: (id: string) => void;
  onCellClick: (pos: GridPosition) => void;
  onCellHover?: (pos: GridPosition | null) => void;
}

interface GridEntity {
  id: string;
  position: GridPosition;
  label: string;           // Initial oder kurzer Name
  color: string;           // Token-Farbe
  size?: number;           // 1 = Medium, 2 = Large, etc.
  isActive?: boolean;      // Aktueller Turn
  conditions?: string[];   // Icons fuer Conditions
}

interface GridPosition {
  x: number;
  y: number;
}

interface TerrainCell {
  position: GridPosition;
  type: 'difficult' | 'hazard' | 'cover' | 'wall';
  opacity?: number;
}
```

### Rendering-Layer

Das Canvas rendert in folgender Reihenfolge (von unten nach oben):

1. **Grid-Linien** - Zellen-Grenzen
2. **Terrain** - Schwieriges Gelaende, Deckung, Waende
3. **Highlights** - Bewegungsreichweite, Zielzellen
4. **Tokens** - Entity-Kreise mit Label
5. **Selektion** - Ring um ausgewaehlte Entity
6. **Active-Marker** - Ring um aktiven Combatant

### Token-Darstellung

```
┌──────────┐
│    G     │  <- Label (Initial)
│   ───    │  <- HP-Bar (optional)
│  [💀]    │  <- Condition-Icon
└──────────┘
```

**Farben:**

| Gruppe | Farbe |
|--------|-------|
| Party | Blau (#4A90D9) |
| Enemy | Rot (#D94A4A) |
| Neutral | Grau (#888888) |
| Ally | Gruen (#4AD94A) |

### Highlights

| Typ | Farbe | Verwendung |
|-----|-------|------------|
| Movement | Blau (halbtransparent) | Erreichbare Zellen |
| Target | Rot (halbtransparent) | Angriffsziele |
| Path | Gestrichelte Linie | Geplanter Bewegungspfad |

---

## ActionPanel

**Pfad:** `src/views/shared/ActionPanel.svelte`

Einheitliches Panel fuer AI-Vorschlaege und manuelle Aktionen.

### Design-Prinzipien

- **Kompakt:** Minimaler Platzverbrauch, keine Ueberschriften
- **Fokussiert:** Nur essentielle Informationen
- **Hover-Tooltips:** Direkt auf Namen, kein separater Trigger

### Props

```typescript
interface ActionPanelProps {
  // Position
  position: GridPosition;
  cellSize: number;
  anchor?: 'right' | 'left' | 'top' | 'bottom';  // default: 'right'

  // Aktions-Daten
  action: Action;
  attacker: Combatant;
  target: Combatant;

  // Berechnete Werte
  modifiers: ActionModifier[];

  // Handlers
  onRoll: () => void;
  onEnterResult: () => void;
}

interface ActionModifier {
  name: string;                // "Pack Tactics"
  effect: string;              // "Advantage"
  source: 'attacker' | 'target' | 'terrain' | 'condition';
}
```

### Layout

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

| Element | Beschreibung |
|---------|--------------|
| **Aktions-Name** | Hover zeigt Schema-generierte Beschreibung |
| **Roll-Info** | `+X vs AC Y` oder `DC X [Ability]` |
| **Damage** | Dice-Expression |
| **Modifikatoren** | Collapsible, Hover zeigt Detail-Erklaerung |
| **[Roll]** | Wuerfelt im Tool |
| **[Enter Result]** | Oeffnet Eingabe-Dialog fuer Tisch-Wuerfel |

**Nicht enthalten:** Target-Name, Accept-Button, separater [?] Trigger, Score.

### Positionierung

Das Panel wird relativ zum Canvas-Container beim Target-Token positioniert:

```
Token     ActionPanel (anchor: right)
  +--+    +-------------------------+
  |G | -> | Shortbow                |
  +--+    | +4 vs AC 16 · 1d6+2     |
          | [Roll] [Enter Result]   |
          +-------------------------+
```

### Styling

```css
.action-panel {
  position: absolute;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 100;
  font-size: 12px;
  min-width: 180px;
}

.action-panel .action-name {
  font-weight: 600;
  cursor: help;  /* Zeigt Tooltip bei Hover */
}

.action-panel .roll-info {
  color: var(--text-muted);
}

.action-panel .modifiers {
  border-top: 1px solid var(--background-modifier-border);
  padding-top: 6px;
  margin-top: 6px;
}

.action-panel .modifier {
  cursor: help;  /* Zeigt Tooltip bei Hover */
}

.action-panel .actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--background-modifier-border);
  padding-top: 8px;
  margin-top: 8px;
}

.action-panel .btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 3px;
  padding: 4px 12px;
  cursor: pointer;
  flex: 1;
}
```

---

## ResolutionPopup

**Pfad:** `src/views/shared/ResolutionPopup.svelte`

Unified Popup fuer alle Resolution-Typen: Actions, Reactions, Concentration, Turn Effects.

### Design-Prinzipien

- **Ein Popup, alle Typen:** Discriminated Union steuert Darstellung
- **Reaktiv:** Felder erscheinen/verschwinden je nach Kontext
- **Konsistent:** Gleiche UI-Patterns fuer alle Resolution-Typen

### Props

```typescript
interface ResolutionPopupProps {
  request: ResolutionRequest;
  onResolve: (result: ResolutionResult) => void;
  onCancel: () => void;
}

type ResolutionRequest =
  | { type: 'action'; action: Action; attacker: Combatant; target: Combatant; mode: 'roll' | 'enter' }
  | { type: 'reaction'; reaction: Action; owner: Combatant; trigger: string }
  | { type: 'concentration'; combatant: Combatant; spell: string; damage: number }
  | { type: 'turnEffect'; combatant: Combatant; timing: 'start' | 'end'; effect: EffectInfo };

type ResolutionResult =
  | { type: 'action'; rollResult: RollResult; attackRoll?: number; damageRoll?: number; totalDamage: number }
  | { type: 'reaction'; used: boolean }
  | { type: 'concentration'; saved: boolean }
  | { type: 'turnEffect'; saved: boolean; damage?: number };

interface EffectInfo {
  name: string;
  description: string;
  saveDC: number;
  saveAbility: string;
  damage?: string;  // Dice expression
}
```

### Type-spezifisches Verhalten

| Type | Header | Info | Result-Buttons | Schaden |
|------|--------|------|----------------|---------|
| **action** (attack) | `{action} → {target}` | Attack Roll + Modifier | Hit / Miss / Crit | Bei Hit/Crit |
| **action** (save) | `{action} → {target}` | DC + Ability | Save / Fail | Immer (half bei Save) |
| **reaction** | `⚡ Reaction verfuegbar` | Trigger + Effekt | Verwenden / Ignorieren | - |
| **concentration** | `🎯 Concentration-Check` | Spell + DC | Save erfolgt / fehlgeschlagen | - |
| **turnEffect** | `{name}'s Zug` + Timing | Effekt + DC | Save erfolgt / fehlgeschlagen | Bei Fail |

### Layout

```
+-------------------------------------+
| [Icon] {Header-Text}                |  <- Variabel je nach Type
+------------------------------------- +
| {Info-Sektion}                      |  <- Variabel je nach Type
|                                     |
| {Optional: Wuerfel-Eingabe}         |  <- Nur bei action + mode='enter'
|                                     |
| [{Result-Button}] [{Result-Button}] |  <- Labels variabel
+-------------------------------------+
| {Optional: Schaden-Sektion}         |  <- Nur wenn Schaden relevant
|                                     |
| [Abbrechen]        [Bestaetigen]    |
+-------------------------------------+
```

### Ersetzt

Dieses Popup ersetzt folgende separate Komponenten:
- `ActionResolutionPopup.svelte`
- `ReactionPrompt.svelte`
- `ConcentrationPrompt.svelte`
- `TurnEffectPrompt.svelte`

---

## Tooltip

**Pfad:** `src/views/shared/Tooltip.svelte`

View-übergreifendes Popup-System für kontextuelle Hilfe und Schema-Beschreibungen.

→ **Vollständige Dokumentation:** [Tooltip.md](Tooltip.md)

---

## Verwendung nach View

| View | GridCanvas | ActionPanel | Notizen |
|------|:----------:|:-----------:|---------|
| **EncounterRunner** | | | |
| - CombatTab | ✓ | ✓ | Volle Funktionalitaet |
| - ChaseTab | ✓ | - | Vereinfachte Zonen-Darstellung |
| - SocialTab | - | - | Kein Grid |
| **DetailView** | | | |
| - Dungeon | ✓ | - | Fog of War, Licht |
| **Cartographer** | - | - | Verwendet HexCanvas (separat) |

---

## Erweiterungen (geplant)

| Komponente | Beschreibung | Status |
|------------|--------------|--------|
| **HexCanvas** | Hex-Grid fuer Overworld | Geplant |
| **MiniMap** | Kleine Uebersichtskarte | Geplant |
| **TokenDrag** | Drag & Drop fuer Tokens | Geplant |

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/views/shared/GridCanvas.svelte` | Grid + Token Rendering |
| `src/views/shared/ActionPanel.svelte` | AI/Manuelle Aktion Panel |
| `src/views/shared/ResolutionPopup.svelte` | Unified Resolution Popup |
| `src/views/shared/Tooltip.svelte` | Hover-Popup System → [Tooltip.md](Tooltip.md) |
| `src/views/shared/types.ts` | Shared TypeScript Interfaces |
| `src/views/shared/tooltipHelpers.ts` | Schema-Generierung fuer Tooltips |
| `src/views/shared/index.ts` | Re-exports |

---

*Siehe auch: [EncounterRunner](EncounterRunner.md) | [CombatTab](EncounterRunner/CombatTab.md) | [Tooltip](Tooltip.md) | [DetailView](DetailView.md)*
