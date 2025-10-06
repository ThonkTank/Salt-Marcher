# Auto-Calculator Tooltip Implementation

This document describes the tooltip and visual feedback system added to the Auto-Calculator UI in the Salt Marcher plugin.

## Overview

The auto-calculator now includes:
1. **Informative tooltips** explaining calculations
2. **Visual feedback** when values are auto-calculated
3. **Help icons** (ℹ) next to important controls
4. **Hover effects** for better UX

## Implementation Files

### 1. `/src/apps/library/create/shared/auto-calc.ts`

**Added Functions:**
- `getToHitTooltip()` - Generates human-readable formula for to-hit calculations
- `getDamageTooltip()` - Generates human-readable formula for damage calculations

**Added Methods to `EntryAutoCalculator` class:**
- `getToHitTooltipText()` - Returns tooltip text for current to-hit config
- `getDamageTooltipText()` - Returns tooltip text for current damage config

**Example Output:**
- To-Hit: `"1d20 +5 (STR) +2 (Prof) = +7"`
- Damage: `"2d6 +3 (STR) slashing"`

### 2. `/src/apps/library/create/creature/components/entry-card-autocal.ts`

New file with enhanced auto-calculator UI component including:

**Helper Functions:**
- `createTooltipIcon()` - Creates info icon with tooltip
- `triggerCalculationFlash()` - Triggers visual feedback animation
- `updateInputTooltip()` - Updates input element's tooltip text

**Main Component:**
- `createAttackSectionWithAutoCalc()` - Enhanced attack section with tooltips

**Features:**
- Prof checkbox has tooltip: "Proficiency bonus: +2 to +6 based on creature's Challenge Rating"
- Ability dropdown has helpful context
- To-Hit input shows calculation formula on hover
- Damage input shows breakdown on hover
- Visual flash effect when values recalculate

### 3. CSS Additions for `/src/app/css.ts`

Add these styles to the `editorLayoutsCss` section:

```css
/* === Auto-Calculator Tooltips & Visual Feedback === */

/* Tooltip icon for help text */
.sm-cc-tooltip-icon {
    display: inline-block;
    margin-left: 4px;
    opacity: 0.5;
    cursor: help;
    font-size: .9em;
    transition: opacity 120ms ease, transform 120ms ease;
}

.sm-cc-tooltip-icon:hover {
    opacity: 1;
    transform: scale(1.1);
}

/* Input with calculated value tooltip */
.sm-cc-input--has-tooltip {
    cursor: help;
    border-color: color-mix(in srgb, var(--interactive-accent) 35%, transparent);
}

.sm-cc-input--has-tooltip:hover {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--interactive-accent) 25%, transparent);
}

/* Flash animation for calculated values */
.sm-cc-input--calculated {
    animation: calculated-flash 0.3s ease;
}

@keyframes calculated-flash {
    0%, 100% {
        background-color: var(--background-secondary);
    }
    50% {
        background-color: color-mix(in srgb, var(--interactive-accent) 25%, var(--background-secondary));
    }
}

/* Label with icon wrapper */
.sm-cc-label-with-icon {
    display: inline-flex;
    align-items: center;
    gap: .25rem;
}
```

## Usage

### Using the New Auto-Calc Component

To use the enhanced auto-calculator in entry cards:

```typescript
import { createAttackSectionWithAutoCalc } from './entry-card-autocal';

// In your entry card creation function:
if (currentType === 'attack') {
    createAttackSectionWithAutoCalc(card, entry, data, index, onUpdate);
}
```

### Tooltip Examples

1. **Prof Checkbox:**
   - Native title attribute
   - Shows: "Proficiency bonus: +2 to +6 based on creature's Challenge Rating"

2. **To-Hit Input:**
   - Updates dynamically based on ability and prof bonus
   - Example: "1d20 +5 (STR) +2 (Prof) = +7"
   - Shows formula breakdown

3. **Damage Input:**
   - Shows dice + ability + type
   - Example: "2d6 +3 (STR) slashing"

4. **Help Icons (ℹ):**
   - Low opacity (50%) by default
   - Scales up on hover (110%)
   - Has cursor: help

## Visual Feedback

### Calculation Flash

When a value is auto-calculated:
1. Input gets `.sm-cc-input--calculated` class
2. Background flashes to accent color (25% opacity)
3. Animation duration: 300ms
4. Class automatically removed after animation

### Tooltip Indicators

Inputs with tooltips:
- Get subtle accent-colored border
- Border intensifies on hover
- Cursor changes to help pointer
- Box shadow appears on hover

## Browser Compatibility

- Uses CSS `color-mix()` for theme-aware colors
- Fallback: Modern browsers (Chrome 111+, Firefox 113+, Safari 16.2+)
- Animation uses standard CSS keyframes
- Tooltips use native `title` attribute (universal support)

## Accessibility

1. **ARIA Labels:**
   - All controls have proper aria-label attributes
   - Help icons have both aria-label and title

2. **Keyboard Navigation:**
   - All interactive elements are keyboard accessible
   - Help icons are focusable

3. **Screen Readers:**
   - Tooltip text available via title attribute
   - Help icons announce their purpose

4. **Color Contrast:**
   - Uses theme variables for accessibility
   - Works in both light and dark themes

## Testing Checklist

- [ ] Tooltips appear on hover
- [ ] Flash animation triggers on calculation
- [ ] Help icons scale on hover
- [ ] Tooltips update when values change
- [ ] Works in light theme
- [ ] Works in dark theme
- [ ] Keyboard navigation works
- [ ] Screen reader announces tooltips

## Future Enhancements

Potential improvements:
1. Custom tooltip component with richer formatting
2. Calculation history/log
3. Interactive formula builder
4. Keyboard shortcuts for common operations
5. Preset calculation templates

## File Paths (Absolute)

- Auto-calc logic: `/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/src/apps/library/create/shared/auto-calc.ts`
- Enhanced component: `/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/src/apps/library/create/creature/components/entry-card-autocal.ts`
- CSS file: `/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/src/app/css.ts`
- Documentation: `/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/TOOLTIP_IMPLEMENTATION.md`
