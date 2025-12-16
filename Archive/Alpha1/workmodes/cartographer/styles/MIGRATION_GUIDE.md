# CSS Migration Guide

Step-by-step guide for migrating existing Cartographer components to use the new CSS foundation system.

## Overview

**Goal**: Replace inline styles and scattered CSS with the unified design system.

**Benefits:**
- Consistent styling across all components
- Theme support (light/dark mode)
- Responsive behavior built-in
- Easier maintenance
- Better performance (reduced recalculations)

## Migration Steps

### Step 1: Import the Stylesheet

Add to the main Cartographer entry point (e.g., `controller.ts` or `index.ts`):

```typescript
import './styles/cartographer.css';
```

This single import brings in all stylesheets via `@import` statements.

### Step 2: Replace Layout Inline Styles

**Before:**
```typescript
const container = parentElement.createDiv();
container.style.display = 'flex';
container.style.flexDirection = 'column';
container.style.width = '100%';
container.style.height = '100%';
```

**After:**
```typescript
const container = parentElement.createDiv({ cls: 'sm-cartographer' });
```

### Step 3: Migrate Button Styles

**Before:**
```typescript
const button = container.createEl('button');
button.style.padding = '8px 16px';
button.style.background = '#4A90E2';
button.style.color = 'white';
button.style.border = 'none';
button.style.borderRadius = '6px';
button.style.cursor = 'pointer';
button.textContent = 'Save';
```

**After:**
```typescript
const button = container.createEl('button', {
  cls: 'sm-btn sm-btn--primary',
  text: 'Save'
});
```

### Step 4: Migrate Form Controls

**Before:**
```typescript
const input = container.createEl('input');
input.type = 'text';
input.style.width = '100%';
input.style.padding = '8px';
input.style.border = '1px solid #dee2e6';
input.style.borderRadius = '6px';
```

**After:**
```typescript
const input = container.createEl('input', {
  type: 'text',
  cls: 'sm-form-control'
});
```

### Step 5: Migrate Panels and Sections

**Before:**
```typescript
const panel = container.createDiv();
panel.style.background = '#ffffff';
panel.style.border = '1px solid #dee2e6';
panel.style.borderRadius = '6px';
panel.style.padding = '16px';

const header = panel.createDiv();
header.style.marginBottom = '16px';
header.style.paddingBottom = '8px';
header.style.borderBottom = '1px solid #dee2e6';
```

**After:**
```typescript
const panel = container.createDiv({ cls: 'sm-panel' });
const header = panel.createDiv({ cls: 'sm-panel__header' });
const body = panel.createDiv({ cls: 'sm-panel__body' });
```

### Step 6: Migrate Inspector Panel

**Before:**
```typescript
const inspector = container.createDiv();
inspector.style.width = '280px';
inspector.style.background = '#f8f9fa';
inspector.style.borderLeft = '1px solid #dee2e6';
inspector.style.overflowY = 'auto';

const section = inspector.createDiv();
section.style.marginBottom = '24px';
```

**After:**
```typescript
const inspector = container.createDiv({ cls: 'sm-cartographer__inspector-panel' });
const section = inspector.createDiv({ cls: 'sm-inspector-section' });
```

### Step 7: Migrate Layer Panel

**Before:**
```typescript
const layerPanel = container.createDiv();
layerPanel.style.width = '280px';
layerPanel.style.background = '#f8f9fa';
layerPanel.style.borderRight = '1px solid #dee2e6';

const layerItem = layerPanel.createDiv();
layerItem.style.padding = '8px';
layerItem.style.background = '#ffffff';
layerItem.style.border = '1px solid #dee2e6';
layerItem.style.borderRadius = '6px';
```

**After:**
```typescript
const layerPanel = container.createDiv({ cls: 'sm-cartographer__layer-panel' });
const layerItem = layerPanel.createDiv({ cls: 'sm-layer-item sm-layer-item--weather' });
```

### Step 8: Migrate Tooltips

**Before:**
```typescript
const tooltip = document.body.createDiv();
tooltip.style.position = 'fixed';
tooltip.style.zIndex = '2000';
tooltip.style.background = '#ffffff';
tooltip.style.border = '1px solid #dee2e6';
tooltip.style.borderRadius = '6px';
tooltip.style.padding = '8px 16px';
tooltip.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
```

**After:**
```typescript
const tooltip = document.body.createDiv({ cls: 'sm-tooltip' });
tooltip.setAttribute('data-position', 'top');
tooltip.toggleClass('is-visible', true);
```

## Common Migration Patterns

### Pattern 1: State Classes

**Before:**
```typescript
if (isActive) {
  element.style.background = '#4A90E2';
  element.style.color = 'white';
} else {
  element.style.background = 'transparent';
  element.style.color = '#212529';
}
```

**After:**
```typescript
element.toggleClass('is-active', isActive);
```

### Pattern 2: Visibility Toggle

**Before:**
```typescript
if (isVisible) {
  element.style.display = 'block';
} else {
  element.style.display = 'none';
}
```

**After:**
```typescript
element.toggleClass('sm-hidden', !isVisible);
// or for panels:
element.toggleClass('is-collapsed', !isVisible);
```

### Pattern 3: Spacing

**Before:**
```typescript
element.style.marginTop = '16px';
element.style.marginBottom = '24px';
```

**After:**
```typescript
element.addClasses(['sm-mt-md', 'sm-mb-lg']);
```

### Pattern 4: Colors

**Before:**
```typescript
element.style.color = isError ? '#dc3545' : '#212529';
```

**After:**
```typescript
// Use CSS classes
element.toggleClass('sm-status-message--danger', isError);
// Or use CSS variables in rare cases
element.style.color = 'var(--sm-color-danger)';
```

## Component-Specific Migrations

### Inspector Panel Component

**File**: `components/inspector-panel.ts`

**Find and Replace:**
1. Replace `style.width = '280px'` → class `sm-cartographer__inspector-panel`
2. Replace `style.padding = '16px'` → class `sm-inspector-section__body`
3. Replace manual header styling → class `sm-inspector-section__header`

### Layer Panel Component

**File**: `components/layer-panel.ts` (if exists)

**Find and Replace:**
1. Replace layer item styling → class `sm-layer-item`
2. Replace opacity slider → class `sm-layer-opacity__slider`
3. Replace checkbox styling → class `sm-layer-item__checkbox`

### Tooltip Renderer

**File**: `components/tooltip-renderer.ts`

**Find and Replace:**
1. Replace tooltip positioning logic → use `data-position` attribute
2. Replace fade animations → use `is-visible` class
3. Replace inline shadow/border → use `sm-tooltip` class

## Testing Checklist

After migration, verify:

- [ ] Layout looks identical to original
- [ ] Buttons respond to hover/focus
- [ ] Forms are keyboard-accessible
- [ ] Panels collapse/expand correctly
- [ ] Tooltips position correctly
- [ ] Dark mode works (if Obsidian dark theme enabled)
- [ ] Responsive behavior on narrow windows
- [ ] No console warnings about CSS

## Rollback Plan

If issues arise, you can temporarily disable the new CSS:

```typescript
// Comment out the import
// import './styles/cartographer.css';

// Inline styles will still work as fallback
```

## Performance Considerations

**Before Migration:**
- Inline styles require style recalculation on every change
- No caching, no reusability

**After Migration:**
- CSS classes cached by browser
- Style changes via class toggles (fast)
- Fewer DOM mutations
- Better paint performance

## Breaking Changes

None! The CSS system is additive. Old inline styles will still work alongside new classes.

## Next Steps

1. **Migrate controller.ts**: Main layout structure
2. **Migrate inspector-panel.ts**: Right sidebar
3. **Migrate tooltip-renderer.ts**: Hover tooltips
4. **Migrate tool-toolbar.ts**: Tool buttons
5. **Remove inline styles**: Clean up after verification

## Need Help?

- **Reference**: `styles/README.md` - Complete documentation
- **Quick lookup**: `styles/QUICK_REFERENCE.md` - Class names
- **Examples**: Check existing Obsidian components for patterns
- **Debugging**: Use browser DevTools to inspect applied styles

## Example: Complete Migration

**Before** (inline styles):
```typescript
export function createInspectorPanel(app: App, container: HTMLElement) {
    const root = container.createDiv();
    root.style.width = '280px';
    root.style.background = '#f8f9fa';
    root.style.borderLeft = '1px solid #dee2e6';
    root.style.overflowY = 'auto';

    const header = root.createDiv();
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.padding = '16px';
    header.style.borderBottom = '1px solid #dee2e6';

    const title = header.createSpan();
    title.textContent = 'Inspector';
    title.style.fontWeight = '600';
    title.style.fontSize = '16px';

    const button = header.createEl('button');
    button.textContent = 'Toggle';
    button.style.padding = '4px 8px';
    button.style.background = 'transparent';
    button.style.border = 'none';
    button.style.cursor = 'pointer';
}
```

**After** (CSS classes):
```typescript
export function createInspectorPanel(app: App, container: HTMLElement) {
    const root = container.createDiv({ cls: 'sm-cartographer__inspector-panel' });

    const header = root.createDiv({ cls: 'sm-cartographer__inspector-header' });

    const title = header.createSpan({
        cls: 'sm-cartographer__inspector-title',
        text: 'Inspector'
    });

    const button = header.createEl('button', {
        cls: 'sm-cartographer__inspector-toggle',
        text: 'Toggle'
    });
}
```

**Result:**
- 80% less code
- Consistent with design system
- Theme-aware
- Keyboard accessible
- Responsive
