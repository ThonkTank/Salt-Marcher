# Shared UI Components

## Purpose

`ui/components` owns reusable JavaFX component families that are shared across product features.

## Canonical Types and APIs

- `ui.components.*` legacy entrypoints - compatibility shims only - keep existing callers stable while the family homes below become canonical.
- `ui.components.dropdown.AnchoredDropdown` - shared non-modal popup anchor primitive with focus-restore behavior.
- `ui.components.dropdown.MessageDropdown` - shared anchored message surface for lightweight notices.
- `ui.components.dropdown.ConfirmationDropdown` - shared anchored confirm/cancel surface for destructive actions.
- `ui.components.dropdown.TextInputDropdown` - shared anchored single-field form surface with inline validation.
- `ui.components.control.SearchableFilterButton` - shared searchable multi-select filter trigger.
- `ui.components.control.SliderControl` - shared labeled slider with optional auto mode.
- `ui.components.control.CrRangeSelector` - shared CR min/max pair selector.
- `ui.components.difficulty.DifficultyMeter` - shared Canvas-based encounter difficulty bar.
- `ui.components.difficulty.DifficultyStyles.applyDifficultyStyle(Label, String)` - shared difficulty label style mapper.
- `ui.components.layout.LayoutComponents.controlSeparator()` - shared separator node for stacked control layouts.
- `ui.components.catalog.AbstractCatalogBrowserPane` - shared paged catalog browser base for list-style catalog surfaces.

## Where New Code Goes

- Put anchored popup primitives and popup variants in `dropdown`.
- Put reusable filter and input controls in `control`.
- Put difficulty presentation widgets and difficulty-specific style helpers in `difficulty`.
- Put tiny reusable layout helpers in `layout`.
- Put shared catalog browser shells in `catalog`.

## Forbidden Drift

- Do not add new shared component work back into the legacy `ui.components.*` compatibility shims.
- Do not recreate mixed utility catch-alls like the removed `ThemeColors`.
- Do not introduce feature-specific workflow logic into shared component families.
