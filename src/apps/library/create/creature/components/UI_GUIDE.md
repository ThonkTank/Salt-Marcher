# Component System UI Guide

## Visual Layout

### Entry Card with Components

```
┌─────────────────────────────────────────────────────────┐
│ [ACTION] Fire Breath                      [↑][↓][×]     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [○] Area of Effect        [↑][↓][⎘][🗑]        │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  Type:   [Cone ▼]                               │   │
│  │  Size:   30 ft.                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [🛡] Saving Throw         [↑][↓][⎘][🗑]        │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  Save:       [DEX ▼]                            │   │
│  │  DC:         15                                 │   │
│  │  On Success: half damage                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [⚡] Damage                [↑][↓][⎘][🗑]        │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  Dice:   2d6                                    │   │
│  │  Bonus:  auto                                   │   │
│  │  Ability: [STR ▼]                               │   │
│  │  Type:   [Fire ▼]                               │   │
│  │                                                  │   │
│  │  Preview: 13 (2d6 +3) fire damage               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [↻] Recharge              [↑][↓][⎘][🗑]        │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  Recharge: Recharge 5-6                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [+ Add Component... ▼]                          │   │
│  │   Combat                                        │   │
│  │     Attack Roll                                 │   │
│  │     Damage                                      │   │
│  │     Saving Throw                                │   │
│  │     Area of Effect                              │   │
│  │   Effects                                       │   │
│  │     Condition                                   │   │
│  │   Meta                                          │   │
│  │     Recharge                                    │   │
│  │     Limited Uses                                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  Details                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ The dragon exhales fire in a 30-foot cone...   │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Component Card Anatomy

### Component Card Structure

```
┌─────────────────────────────────────────────────────┐
│ Header (background-secondary-alt)                   │
│  ┌────────────────────┐  ┌───────────────────────┐ │
│  │ [Icon] Label       │  │ [↑][↓][⎘][🗑]        │ │
│  │                    │  │ Controls             │ │
│  └────────────────────┘  └───────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Content (padding: 0.75rem)                          │
│                                                     │
│  Form fields specific to component type...         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Component Header Elements

```
Icon Colors by Type:
├─ [⚔️] Attack Roll       (Red border)
├─ [⚡] Damage            (Orange border)
├─ [🛡️] Saving Throw      (Blue border)
├─ [⚠️] Condition         (Purple border)
├─ [○] Area of Effect    (Teal border)
├─ [↻] Recharge          (Green border)
└─ [#] Limited Uses      (Gray border)
```

### Control Buttons

```
[↑] Move Up      - Chevron up icon
[↓] Move Down    - Chevron down icon
[⎘] Duplicate    - Copy icon
[🗑] Delete       - Trash icon (red on hover)
```

## Component Type Details

### 1. Attack Roll Component

```
┌─────────────────────────────────────────┐
│ [⚔️] Attack Roll    [↑][↓][⎘][🗑]      │
├─────────────────────────────────────────┤
│  To Hit:       +5                       │
│  Reach/Range:  5 ft.                    │
│  Target:       one target               │
└─────────────────────────────────────────┘
```

**Fields:**
- To Hit: Text input for attack bonus
- Reach/Range: Text input for distance
- Target: Text input for target description

### 2. Damage Component

```
┌─────────────────────────────────────────┐
│ [⚡] Damage          [↑][↓][⎘][🗑]      │
├─────────────────────────────────────────┤
│  ┌─ Primary Damage ─────────────────┐  │
│  │  Dice:   2d6                     │  │
│  │  Bonus:  auto                    │  │
│  │  Ability: [STR ▼]                │  │
│  │  Type:   [Slashing ▼]            │  │
│  │  Preview: 13 (2d6 +3) slashing   │  │
│  └──────────────────────────────────┘  │
│                                         │
│  [+ Additional Damage]                  │
└─────────────────────────────────────────┘
```

**Features:**
- Multiple damage instances
- Auto-calculation support
- Damage type selection
- Real-time preview

### 3. Saving Throw Component

```
┌─────────────────────────────────────────┐
│ [🛡️] Saving Throw   [↑][↓][⎘][🗑]      │
├─────────────────────────────────────────┤
│  Save:       [DEX ▼]                    │
│  DC:         15                         │
│  On Success: half damage                │
└─────────────────────────────────────────┘
```

**Fields:**
- Save: Dropdown (STR, DEX, CON, INT, WIS, CHA)
- DC: Number input (1-30)
- On Success: Text input for effect

### 4. Condition Component

```
┌─────────────────────────────────────────┐
│ [⚠️] Condition       [↑][↓][⎘][🗑]      │
├─────────────────────────────────────────┤
│  Condition: poisoned                    │
│  Duration:  1 minute                    │
│                                         │
│  [✓] Can save at end of each turn      │
└─────────────────────────────────────────┘
```

**Fields:**
- Condition: Text input for condition name
- Duration: Text input for duration
- Save at end: Checkbox for recurring saves

### 5. Area of Effect Component

```
┌─────────────────────────────────────────┐
│ [○] Area of Effect  [↑][↓][⎘][🗑]      │
├─────────────────────────────────────────┤
│  Type: [Cone ▼]                         │
│        Sphere, Cone, Line,              │
│        Cube, Cylinder, Custom           │
│  Size: 30 ft.                           │
└─────────────────────────────────────────┘
```

**Fields:**
- Type: Dropdown (sphere, cone, line, cube, cylinder, custom)
- Size: Text input for dimensions

### 6. Recharge Component

```
┌─────────────────────────────────────────┐
│ [↻] Recharge        [↑][↓][⎘][🗑]      │
├─────────────────────────────────────────┤
│  Recharge: Recharge 5-6                 │
└─────────────────────────────────────────┘
```

**Single Field:**
- Recharge: Text input (e.g., "Recharge 5-6", "1/Day")

### 7. Limited Uses Component

```
┌─────────────────────────────────────────┐
│ [#] Limited Uses    [↑][↓][⎘][🗑]      │
├─────────────────────────────────────────┤
│  Uses: 3/Day each                       │
└─────────────────────────────────────────┘
```

**Single Field:**
- Uses: Text input (e.g., "1/Day", "3/Day each")

## Component Selector

### Dropdown Structure

```
┌─────────────────────────────────────────┐
│ [+ Add Component... ▼]                  │
├─────────────────────────────────────────┤
│ Combat                                  │
│   Attack Roll                           │
│   Damage                                │
│   Saving Throw                          │
│   Area of Effect                        │
├─────────────────────────────────────────┤
│ Effects                                 │
│   Condition                             │
├─────────────────────────────────────────┤
│ Meta                                    │
│   Recharge                              │
│   Limited Uses                          │
└─────────────────────────────────────────┘
```

### Visual States

**Default State:**
```
┌─────────────────────────────────────────┐
│ [+ Add Component... ▼]                  │
└─────────────────────────────────────────┘
```

**Hover State:**
```
┌─────────────────────────────────────────┐
│ [+ Add Component... ▼]                  │
│ (background: secondary)                 │
└─────────────────────────────────────────┘
```

**Focus State:**
```
┌═════════════════════════════════════════┐
│ [+ Add Component... ▼]                  │
│ (outline: accent color)                 │
└═════════════════════════════════════════┘
```

## Interaction States

### Component Card States

**Default:**
```
┌─────────────────────────────────────────┐
│ Component Header                         │
│ border: 1px solid border-color          │
│ border-left: 3px solid type-color       │
└─────────────────────────────────────────┘
```

**Hover:**
```
┌─────────────────────────────────────────┐
│ Component Header                         │
│ border: 1px solid accent                │
│ shadow: 0 2px 8px rgba(0,0,0,0.1)      │
└─────────────────────────────────────────┘
```

**Disabled Button:**
```
[↑] opacity: 0.3
    cursor: not-allowed
```

**Delete Button Hover:**
```
[🗑] background: error-color
    color: white
```

## Empty State

### No Components Yet

```
┌─────────────────────────────────────────────────────┐
│ [ACTION] New Ability                  [↑][↓][×]     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌═════════════════════════════════════════════┐   │
│  │ [+ Add Component... ▼]                      │   │
│  │ (highlighted with accent border)            │   │
│  └═════════════════════════════════════════════┘   │
│                                                      │
│  Details                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ Describe the ability...                     │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Animation Sequences

### Adding Component

```
1. User selects component type
   ↓
2. Dropdown resets to placeholder
   ↓
3. New component slides in (slideIn animation)
   opacity: 0 → 1
   transform: translateY(-10px) → translateY(0)
   duration: 200ms
   ↓
4. Component appears in list
```

### Deleting Component

```
1. User clicks delete button
   ↓
2. Component fades out
   opacity: 1 → 0
   duration: 150ms
   ↓
3. List re-flows smoothly
```

### Reordering Components

```
1. User clicks move up/down
   ↓
2. Components swap positions
   ↓
3. List re-renders
   ↓
4. New component slides in
```

## Responsive Layouts

### Desktop (> 768px)

```
┌─────────────────────────────────────────┐
│ Header (horizontal layout)              │
│  [Icon] Label        [↑][↓][⎘][🗑]     │
├─────────────────────────────────────────┤
│ Content (2-column grid)                 │
│  Label:  [Input Field    ]             │
│  Label:  [Input Field    ]             │
└─────────────────────────────────────────┘
```

### Mobile (< 768px)

```
┌─────────────────────────────┐
│ Header (vertical layout)    │
│  [Icon] Label               │
│  [↑][↓][⎘][🗑]             │
├─────────────────────────────┤
│ Content (1-column layout)   │
│  Label:                     │
│  [Input Field          ]   │
│                             │
│  Label:                     │
│  [Input Field          ]   │
└─────────────────────────────┘
```

## Color Palette

### Component Type Colors

```css
Attack Roll:       #e74c3c (Red)
Damage:           #f39c12 (Orange)
Saving Throw:     #3498db (Blue)
Condition:        #9b59b6 (Purple)
Area of Effect:   #1abc9c (Teal)
Recharge:         #27ae60 (Green)
Limited Uses:     #95a5a6 (Gray)
```

### UI Colors

```css
Background:       var(--background-secondary)
Header:           var(--background-secondary-alt)
Border:           var(--background-modifier-border)
Accent:           var(--interactive-accent)
Text:             var(--text-normal)
Text Muted:       var(--text-muted)
Hover:            var(--background-modifier-hover)
Error:            var(--background-modifier-error)
```

## Icon Reference

### Component Icons

```
⚔️  sword           - Attack Roll
⚡  zap             - Damage
🛡️  shield          - Saving Throw
⚠️  alert-circle    - Condition
○  circle-dashed   - Area of Effect
↻  refresh-cw      - Recharge
#  hash            - Limited Uses
```

### Control Icons

```
↑  chevron-up      - Move Up
↓  chevron-down    - Move Down
⎘  copy            - Duplicate
🗑  trash-2         - Delete
```

## Keyboard Navigation

### Tab Order

```
1. Component Card Header
2. Move Up Button
3. Move Down Button
4. Duplicate Button
5. Delete Button
6. First Input Field
7. Second Input Field
8. ...
9. Next Component Card
```

### Keyboard Shortcuts

```
Tab       - Move to next field
Shift+Tab - Move to previous field
Enter     - Activate button/submit
Escape    - Close dropdown (if open)
Space     - Toggle checkbox
```

## Accessibility Features

### ARIA Labels

```html
<button aria-label="Move Up">
<button aria-label="Move Down">
<button aria-label="Duplicate">
<button aria-label="Delete">
<select aria-label="Component Type">
<input aria-label="Field Name">
```

### Focus Indicators

```css
:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 2px;
}
```

### Screen Reader Support

- Component type announced on focus
- Button actions announced
- Field labels associated with inputs
- Error states communicated

## Print Styles

### Printed Output

```
Component Card (printed)
├─ Hide: Controls (move/duplicate/delete)
├─ Hide: Component selector
├─ Show: Component content
└─ Avoid: Page breaks inside cards
```

---

This visual guide provides a comprehensive overview of the component system UI. Use it as a reference when implementing or extending the component system.
