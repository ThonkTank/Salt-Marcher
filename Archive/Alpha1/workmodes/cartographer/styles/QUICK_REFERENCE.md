# Cartographer CSS Quick Reference

Fast lookup for common CSS classes and patterns.

## Color Variables

```css
--sm-color-primary      #4A90E2  Blue
--sm-color-secondary    #7B68EE  Purple
--sm-color-success      #28a745  Green
--sm-color-warning      #ffc107  Yellow
--sm-color-danger       #dc3545  Red
--sm-color-info         #17a2b8  Cyan

--sm-color-weather      #4A90E2  Blue
--sm-color-faction      #FF6B6B  Red
--sm-color-location     #4ECDC4  Cyan
--sm-color-building     #FFE66D  Yellow
--sm-color-terrain      #A8E6CF  Green
--sm-color-feature      #B19CD9  Purple
```

## Spacing Scale

```css
--sm-space-xs    4px
--sm-space-sm    8px
--sm-space-md    16px
--sm-space-lg    24px
--sm-space-xl    32px
--sm-space-2xl   48px
```

## Typography

```css
--sm-font-size-xs      12px
--sm-font-size-sm      14px
--sm-font-size-base    16px
--sm-font-size-lg      18px
--sm-font-size-xl      20px
```

## Buttons

| Class | Description |
|-------|-------------|
| `.sm-btn` | Base button |
| `.sm-btn--primary` | Blue primary button |
| `.sm-btn--secondary` | Purple secondary button |
| `.sm-btn--danger` | Red destructive button |
| `.sm-btn--ghost` | Transparent ghost button |
| `.sm-btn--icon` | Square icon-only button |
| `.sm-btn--small` | Small button variant |

```html
<button class="sm-btn sm-btn--primary">Save</button>
```

## Form Controls

| Class | Element | Description |
|-------|---------|-------------|
| `.sm-form-control` | `input`, `textarea` | Base input style |
| `.sm-form-select` | `select` | Dropdown with arrow |
| `.sm-form-textarea` | `textarea` | Auto-growing textarea |
| `.sm-form-checkbox` | `input[type="checkbox"]` | Styled checkbox |
| `.sm-form-range` | `input[type="range"]` | Styled slider |
| `.sm-form-color` | `input[type="color"]` | Color picker |
| `.sm-form-label` | `label` | Form label |
| `.sm-form-group` | `div` | Field container |

```html
<div class="sm-form-group">
  <label class="sm-form-label">Name</label>
  <input type="text" class="sm-form-control">
</div>
```

## Layout

| Class | Description |
|-------|-------------|
| `.sm-cartographer` | Main container (flexbox column) |
| `.sm-cartographer__header` | Top header bar |
| `.sm-cartographer__content` | 3-column content area |
| `.sm-cartographer__layer-panel` | Left sidebar (280px) |
| `.sm-cartographer__canvas` | Center canvas (flex: 1) |
| `.sm-cartographer__inspector-panel` | Right sidebar (280px) |

## Layer Panel

| Class | Description |
|-------|-------------|
| `.sm-layer-tree` | Layer list container |
| `.sm-layer-item` | Single layer item |
| `.sm-layer-item--weather` | Weather layer (blue) |
| `.sm-layer-item--faction` | Faction layer (red) |
| `.sm-layer-item--location` | Location layer (cyan) |
| `.sm-layer-item--building` | Building layer (yellow) |
| `.sm-layer-item--terrain` | Terrain layer (green) |
| `.sm-layer-item--feature` | Feature layer (purple) |
| `.sm-layer-item__header` | Clickable header |
| `.sm-layer-item__checkbox` | Visibility toggle |
| `.sm-layer-item__label` | Layer name |
| `.sm-layer-item__controls` | Expanded controls |
| `.sm-layer-opacity__slider` | Opacity range input |

## Inspector Panel

| Class | Description |
|-------|-------------|
| `.sm-inspector-section` | Inspector section |
| `.sm-inspector-section__header` | Section header |
| `.sm-inspector-section__title` | Section title |
| `.sm-inspector-section__body` | Section content |
| `.sm-tile-info__row` | Info row (label + value) |
| `.sm-tile-info__label` | Row label |
| `.sm-tile-info__value` | Row value |
| `.sm-inspector-weather` | Weather info card |
| `.sm-inspector-features` | Feature list |
| `.sm-feature-item` | Single feature |
| `.sm-inspector-location` | Location info card |
| `.sm-building-card` | Building info card |

## Tooltips

| Class | Description |
|-------|-------------|
| `.sm-tooltip` | Base tooltip |
| `.sm-tooltip.is-visible` | Visible state |
| `.sm-tooltip--compact` | Small tooltip |
| `.sm-tooltip--rich` | Extended tooltip |
| `.sm-tooltip--error` | Error tooltip |
| `.sm-tooltip__header` | Tooltip header |
| `.sm-tooltip__title` | Tooltip title |
| `.sm-tooltip__body` | Tooltip content |
| `.sm-tooltip__row` | Info row |
| `.sm-tooltip__label` | Row label |
| `.sm-tooltip__value` | Row value |

**Data Attributes:**
- `data-position="top|bottom|left|right"` - Arrow position
- `data-edge="top|bottom|left|right"` - Edge detection

## Status Messages

| Class | Color |
|-------|-------|
| `.sm-status-message--info` | Cyan |
| `.sm-status-message--success` | Green |
| `.sm-status-message--warning` | Yellow |
| `.sm-status-message--danger` | Red |

```html
<div class="sm-status-message sm-status-message--success">
  Saved successfully!
</div>
```

## State Classes

| Class | Description |
|-------|-------------|
| `.is-active` | Active/selected state |
| `.is-collapsed` | Collapsed state |
| `.is-expanded` | Expanded state |
| `.is-disabled` | Disabled state |
| `.is-visible` | Visible state |
| `.is-dragging` | Being dragged |
| `.is-drag-over` | Drag target |
| `.is-warning` | Warning state |
| `.is-danger` | Danger state |

## Utility Classes

| Class | Description |
|-------|-------------|
| `.sm-hidden` | Display: none |
| `.sm-text-center` | Text align center |
| `.sm-text-right` | Text align right |
| `.sm-mt-sm/md/lg` | Margin top |
| `.sm-mb-sm/md/lg` | Margin bottom |
| `.sm-p-sm/md/lg` | Padding |

## Common Patterns

### Collapsible Section

```html
<div class="sm-inspector-section is-collapsible">
  <div class="sm-inspector-section__header">
    <h3 class="sm-inspector-section__title">Section Title</h3>
    <span class="sm-inspector-section__toggle-icon">▼</span>
  </div>
  <div class="sm-inspector-section__body">
    Content...
  </div>
</div>
```

### Info Row

```html
<div class="sm-tile-info__row">
  <span class="sm-tile-info__label">Label</span>
  <span class="sm-tile-info__value">Value</span>
</div>
```

### Layer Item

```html
<div class="sm-layer-item sm-layer-item--weather">
  <div class="sm-layer-item__header">
    <span class="sm-layer-item__expand-icon">▶</span>
    <input type="checkbox" class="sm-layer-item__checkbox" checked>
    <div class="sm-layer-item__color"></div>
    <span class="sm-layer-item__label">Weather</span>
    <span class="sm-layer-item__opacity-value">80%</span>
  </div>
</div>
```

### Button Group

```html
<div class="sm-cartographer__actions">
  <button class="sm-btn sm-btn--primary">Save</button>
  <button class="sm-btn sm-btn--ghost">Cancel</button>
</div>
```

### Form Field

```html
<div class="sm-form-group">
  <label class="sm-form-label sm-form-label--required">Name</label>
  <input type="text" class="sm-form-control" placeholder="Enter name...">
</div>
```

## Responsive Breakpoints

```css
@media (max-width: 1024px)  /* Tablet: Stack panels */
@media (max-width: 768px)   /* Mobile: Single column */
```

## Z-Index Layers

```css
--sm-z-canvas: 1
--sm-z-sidebar: 10
--sm-z-toolbar: 20
--sm-z-dropdown: 100
--sm-z-modal: 1000
--sm-z-tooltip: 2000
```

## Keyboard Focus

All interactive elements have focus styles:
- Outline: `2px solid var(--sm-color-primary)`
- Offset: `2px`

## Animations

```css
/* Fade in */
opacity: 0 → 1
transform: translateY(-4px) → translateY(0)

/* Slide down */
opacity: 0 → 1
transform: translateY(-8px) → translateY(0)

/* Spinner */
@keyframes spin { transform: rotate(0deg → 360deg) }
```

## TypeScript Integration

```typescript
// Create with classes
const btn = container.createEl('button', {
  cls: 'sm-btn sm-btn--primary',
  text: 'Save'
});

// Toggle state
btn.toggleClass('is-disabled', disabled);

// Multiple classes
const panel = container.createDiv({
  cls: ['sm-panel', 'is-collapsed']
});
```
