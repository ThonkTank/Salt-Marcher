# Tooltip System

> **Verantwortlichkeit:** View-übergreifendes Popup-System für kontextuelle Hilfe und Schema-Beschreibungen.

**Pfad:** `src/views/shared/Tooltip.svelte`

---

## Übersicht

Einfaches, erweiterbares Tooltip-System für Help-Popups und Schema-generierte Beschreibungen. Wird praktisch überall in der Anwendung verwendet.

| Verwendung | Beispiel |
|------------|----------|
| **Action-Namen** | Schema-generierte Action-Details (Hover ueber Name) |
| **Condition-Namen** | Condition-Regeln (Blinded, Poisoned, etc.) |
| **Modifier-Namen** | Erklaerung woher Modifier kommt |
| **Entity-Namen** | Creature, NPC, Item Details |

**Trigger:** Immer direkter Hover ueber den Namen/Text, kein separater [?] Button.

---

## Props

```typescript
interface TooltipProps {
  // Content
  content: string | (() => string);  // Lazy für Schema-Generierung

  // Positionierung
  position?: 'top' | 'right' | 'bottom' | 'left';  // default: 'top'

  // Timing
  delay?: number;  // ms vor Anzeige (default: 300)
}
```

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `content` | `string \| () => string` | - | Text oder Lazy-Funktion |
| `position` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'top'` | Anker-Position |
| `delay` | `number` | `300` | Verzögerung in ms |

**Lazy Content:** Für aufwändige Schema-Generierung kann `content` eine Funktion sein, die erst bei Hover ausgewertet wird.

---

## Verwendung

### Direkter Hover

```svelte
<Tooltip content="Erklaerung des Modifiers">
  <span class="modifier-name">Pack Tactics</span>
</Tooltip>
```

### Lazy Content (Schema-Generierung)

```svelte
<Tooltip content={() => generateActionDescription(action)}>
  <span class="action-name">{action.name}</span>
</Tooltip>
```

Der Tooltip erscheint bei Hover ueber den umschlossenen Inhalt - kein separater Trigger noetig.

---

## Schema-generierte Beschreibungen

Für Actions wird die Beschreibung aus dem Schema generiert:

```typescript
function generateActionDescription(action: Action): string {
  const parts: string[] = [];

  // Typ
  parts.push(`${action.actionType} (${action.timing.type})`);

  // Range
  if (action.range.type === 'reach') {
    parts.push(`Reach ${action.range.normal}ft`);
  } else if (action.range.type === 'ranged') {
    parts.push(`Range ${action.range.normal}/${action.range.long ?? '-'}ft`);
  }

  // Damage
  if (action.damage) {
    parts.push(`${action.damage.dice}+${action.damage.modifier} ${action.damage.type}`);
  }

  // Effects
  if (action.effects?.length) {
    parts.push(`Effects: ${action.effects.map(e => e.condition).join(', ')}`);
  }

  return parts.join(' · ');
}
```

### Beispiel-Output

```
melee-weapon (action) · Reach 5ft · 1d8+3 slashing
```

---

## Styling

```css
.tooltip {
  position: absolute;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 6px 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 200;
  font-size: 11px;
  max-width: 280px;
  pointer-events: none;
  white-space: pre-wrap;
}
```

| Property | Wert | Begründung |
|----------|------|------------|
| `z-index: 200` | Höher als TokenOverlay (100) | Tooltip über allem |
| `pointer-events: none` | Keine Mouse-Events | Verhindert Flackern |
| `max-width: 280px` | Begrenzte Breite | Lesbarkeit |
| `white-space: pre-wrap` | Zeilenumbrüche erhalten | Formatierung |

---

## Positionierung

Das Tooltip wird automatisch positioniert, um innerhalb des Viewports zu bleiben:

```
         ┌─────────┐
         │ Tooltip │  <- position: 'top'
         └────┬────┘
              │
           ┌──┴──┐
           │ [?] │
           └─────┘
```

**Fallback-Logik:**
1. Versuche gewünschte Position
2. Bei Viewport-Überschreitung: Gegenüberliegende Seite
3. Bei weiterhin Überschreitung: Beste verfügbare Position

---

## Integration mit TokenOverlay

In Combat wird das Tooltip-System für Action-Beschreibungen im TokenOverlay verwendet:

```
+-------------------------+
| Shortbow          [?]   |  <- [?] triggert Tooltip
| +4 vs AC  ·  1d6+2      |
| Score: 8.5    [Accept]  |
+-------------------------+
         │
         ▼
┌────────────────────────────────┐
│ ranged-weapon (action)         │
│ Range 80/320ft · 1d6+2 piercing│
└────────────────────────────────┘
```

---

## Erweiterungen (geplant)

| Feature | Beschreibung | Status |
|---------|--------------|--------|
| **Rich Content** | HTML/Markdown im Tooltip | Geplant |
| **Pinnable** | Tooltip anklicken zum Fixieren | Geplant |
| **Keyboard** | Focus-basierte Anzeige | Geplant |

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/views/shared/Tooltip.svelte` | Tooltip-Komponente |
| `src/views/shared/tooltipHelpers.ts` | Schema-Generierungs-Funktionen |

---

*Siehe auch: [Shared Components](shared.md) | [TokenOverlay](shared.md#tokenoverlay) | [CombatTab](EncounterRunner/CombatTab.md)*
