# Cartographer CSS Foundation System

Comprehensive design system for the Cartographer workmode with unified styling, theme support, and responsive behavior.

## Overview

**Total Size**: ~50KB (4 files, 2,086 lines)
**Created**: 2025-11-07
**Purpose**: Replace scattered inline styles with a maintainable, consistent design system

## File Structure

```
styles/
├── cartographer.css      (548 lines) - Main stylesheet, variables, layout, components
├── layer-panel.css       (406 lines) - Layer control panel styles
├── inspector-panel.css   (610 lines) - Right sidebar inspector styles
└── tooltips.css          (522 lines) - Hover tooltip styles
```

## Usage

Import the main stylesheet in your TypeScript component:

```typescript
import './styles/cartographer.css';
```

This automatically imports all sub-stylesheets via `@import` statements.

## Design System

### CSS Custom Properties

All variables are prefixed with `--sm-` (Salt Marcher) to avoid conflicts with Obsidian's global styles.

#### Colors

```css
/* Primary & Accent */
--sm-color-primary: #4A90E2;        /* Blue - Main accent */
--sm-color-secondary: #7B68EE;      /* Purple - Secondary actions */
--sm-color-success: #28a745;        /* Green - Success states */
--sm-color-warning: #ffc107;        /* Yellow - Warnings */
--sm-color-danger: #dc3545;         /* Red - Destructive actions */
--sm-color-info: #17a2b8;           /* Cyan - Info messages */

/* Neutral Colors (Light Mode) */
--sm-color-bg-primary: #ffffff;
--sm-color-bg-secondary: #f8f9fa;
--sm-color-bg-tertiary: #e9ecef;
--sm-color-text-primary: #212529;
--sm-color-text-secondary: #6c757d;
--sm-color-border: #dee2e6;

/* Layer-specific Colors */
--sm-color-weather: #4A90E2;
--sm-color-faction: #FF6B6B;
--sm-color-location: #4ECDC4;
--sm-color-building: #FFE66D;
--sm-color-terrain: #A8E6CF;
--sm-color-feature: #B19CD9;
```

#### Typography

```css
--sm-font-family-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--sm-font-size-xs: 0.75rem;    /* 12px */
--sm-font-size-sm: 0.875rem;   /* 14px */
--sm-font-size-base: 1rem;     /* 16px */
--sm-font-size-lg: 1.125rem;   /* 18px */
--sm-font-size-xl: 1.25rem;    /* 20px */
```

#### Spacing

```css
--sm-space-xs: 4px;
--sm-space-sm: 8px;
--sm-space-md: 16px;
--sm-space-lg: 24px;
--sm-space-xl: 32px;
--sm-space-2xl: 48px;
```

#### Layout

```css
--sm-cartographer-sidebar-width: 280px;
--sm-cartographer-header-height: 48px;
--sm-cartographer-border-radius: 6px;
--sm-cartographer-transition: 200ms ease;
```

### Component Classes

#### Buttons

```html
<button class="sm-btn sm-btn--primary">Primary Action</button>
<button class="sm-btn sm-btn--secondary">Secondary</button>
<button class="sm-btn sm-btn--danger">Delete</button>
<button class="sm-btn sm-btn--ghost">Cancel</button>
<button class="sm-btn sm-btn--icon">🔍</button>
<button class="sm-btn sm-btn--small">Small</button>
```

#### Form Controls

```html
<!-- Text Input -->
<input type="text" class="sm-form-control" placeholder="Enter text...">

<!-- Select Dropdown -->
<select class="sm-form-control sm-form-select">
  <option>Option 1</option>
</select>

<!-- Textarea -->
<textarea class="sm-form-control sm-form-textarea"></textarea>

<!-- Checkbox -->
<input type="checkbox" class="sm-form-checkbox">

<!-- Range Slider -->
<input type="range" class="sm-form-range" min="0" max="100">

<!-- Color Picker -->
<input type="color" class="sm-form-color">

<!-- Form Group -->
<div class="sm-form-group">
  <label class="sm-form-label">Label</label>
  <input type="text" class="sm-form-control">
</div>
```

#### Panels

```html
<div class="sm-panel">
  <div class="sm-panel__header">
    <h3 class="sm-panel__title">Panel Title</h3>
  </div>
  <div class="sm-panel__body">
    Panel content...
  </div>
</div>
```

#### Status Messages

```html
<div class="sm-status-message sm-status-message--info">Info message</div>
<div class="sm-status-message sm-status-message--success">Success!</div>
<div class="sm-status-message sm-status-message--warning">Warning</div>
<div class="sm-status-message sm-status-message--danger">Error</div>
```

### Layout Structure

```
.sm-cartographer
├── .sm-cartographer__header
│   ├── .sm-cartographer__title
│   └── .sm-cartographer__actions
└── .sm-cartographer__content
    ├── .sm-cartographer__layer-panel (left sidebar)
    ├── .sm-cartographer__canvas (center)
    └── .sm-cartographer__inspector-panel (right sidebar)
```

## Layer Panel (`layer-panel.css`)

Hierarchical layer management with parent/child relationships:

```html
<div class="sm-layer-tree">
  <div class="sm-layer-item sm-layer-item--weather">
    <div class="sm-layer-item__header">
      <span class="sm-layer-item__expand-icon">▶</span>
      <input type="checkbox" class="sm-layer-item__checkbox">
      <div class="sm-layer-item__color"></div>
      <span class="sm-layer-item__label">Weather</span>
      <span class="sm-layer-item__opacity-value">100%</span>
    </div>
    <div class="sm-layer-item__controls">
      <div class="sm-layer-opacity">
        <input type="range" class="sm-layer-opacity__slider">
      </div>
    </div>
  </div>
</div>
```

**Features:**
- Expandable/collapsible sections
- Opacity sliders (0-100%)
- Layer color indicators
- Parent/child checkbox relationships
- Drag-and-drop support (prepared)

## Inspector Panel (`inspector-panel.css`)

Right sidebar for hex tile inspection:

```html
<div class="sm-inspector-section">
  <div class="sm-inspector-section__header">
    <h3 class="sm-inspector-section__title">Tile Info</h3>
  </div>
  <div class="sm-inspector-section__body">
    <div class="sm-tile-info__row">
      <span class="sm-tile-info__label">Terrain</span>
      <span class="sm-tile-info__value">Forest</span>
    </div>
  </div>
</div>
```

**Features:**
- Collapsible sections
- Weather status display
- Feature list
- Location/building info
- Form controls for editing

## Tooltips (`tooltips.css`)

Smart hover tooltips with edge detection:

```html
<div class="sm-tooltip sm-tooltip--rich" data-position="top">
  <div class="sm-tooltip__header">
    <div class="sm-tooltip__icon">🗺️</div>
    <div class="sm-tooltip__title">Forest Hex</div>
  </div>
  <div class="sm-tooltip__body">
    <div class="sm-tooltip__row">
      <span class="sm-tooltip__label">Terrain</span>
      <span class="sm-tooltip__value">Dense Forest</span>
    </div>
  </div>
</div>
```

**Features:**
- Fade in/out animations
- Smart positioning (top/bottom/left/right)
- Edge detection
- Multiple variants (compact, rich, error)
- Weather, location, faction displays

## Theme Support

The system includes prepared dark mode variables:

```css
.theme-dark {
    --sm-color-bg-primary: #1e1e1e;
    --sm-color-bg-secondary: #2d2d2d;
    --sm-color-bg-tertiary: #3a3a3a;
    --sm-color-text-primary: #e0e0e0;
    --sm-color-text-secondary: #a0a0a0;
    --sm-color-border: #4a4a4a;
}
```

Dark mode automatically activates when Obsidian's dark theme is enabled.

## Responsive Breakpoints

```css
/* Tablet (max-width: 1024px) */
- Stack panels vertically
- Reduce sidebar heights

/* Mobile (max-width: 768px) */
- Single column layout
- Smaller spacing
- Full-width sidebars
```

## Accessibility

All components include:
- **Focus states**: `outline: 2px solid var(--sm-color-primary)`
- **Keyboard navigation**: Tab order, focus-visible
- **High contrast**: Prepared for contrast mode
- **ARIA support**: Ready for TypeScript components

## Utility Classes

```css
/* Display */
.sm-hidden

/* Text Alignment */
.sm-text-center
.sm-text-right

/* Spacing */
.sm-mt-sm, .sm-mt-md, .sm-mt-lg    /* margin-top */
.sm-mb-sm, .sm-mb-md, .sm-mb-lg    /* margin-bottom */
.sm-p-sm, .sm-p-md, .sm-p-lg       /* padding */
```

## Integration Guide

### Step 1: Import Stylesheet

In your main Cartographer component (e.g., `controller.ts` or `index.ts`):

```typescript
import './styles/cartographer.css';
```

### Step 2: Apply Base Classes

```typescript
const container = parentElement.createDiv({ cls: 'sm-cartographer' });

const header = container.createDiv({ cls: 'sm-cartographer__header' });
const title = header.createSpan({ cls: 'sm-cartographer__title', text: 'Cartographer' });

const content = container.createDiv({ cls: 'sm-cartographer__content' });
const layerPanel = content.createDiv({ cls: 'sm-cartographer__layer-panel' });
const canvas = content.createDiv({ cls: 'sm-cartographer__canvas' });
const inspector = content.createDiv({ cls: 'sm-cartographer__inspector-panel' });
```

### Step 3: Replace Inline Styles

**Before:**
```typescript
button.style.padding = '8px 16px';
button.style.background = '#4A90E2';
button.style.color = 'white';
```

**After:**
```typescript
button.className = 'sm-btn sm-btn--primary';
```

## Performance Considerations

- **CSS Variables**: Native browser support, no runtime overhead
- **Transitions**: GPU-accelerated (transform, opacity)
- **No !important**: Clean cascade, easy to override
- **Modern CSS**: Flexbox, Grid, color-mix(), custom properties

## Browser Support

- **Chrome/Edge**: 88+ (full support)
- **Firefox**: 85+ (full support)
- **Safari**: 14+ (full support)
- **Obsidian Desktop**: All platforms supported

## Future Enhancements

- [ ] Additional layer types (terrain features, regions)
- [ ] Animation presets for layer transitions
- [ ] Custom color theme support
- [ ] Print stylesheet
- [ ] High contrast mode improvements

## Maintenance

When updating styles:

1. **Add new variables** to `cartographer.css` `:root`
2. **Document changes** in this README
3. **Update TypeScript** components to use new classes
4. **Test responsive** behavior at all breakpoints
5. **Verify accessibility** (keyboard nav, focus states)

## Questions?

Refer to:
- `/docs/workmodes/cartographer.md` - Workmode documentation
- `/docs/guides/refactoring-patterns.md` - Code patterns
- Obsidian CSS variables: `app.vault.adapter.basePath/app.css`
