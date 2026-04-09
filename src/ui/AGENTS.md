# Shared UI

## Purpose

`src/ui` owns shared JavaFX infrastructure that is not specific to one product feature.

## Canonical Types and APIs

- `ui/theme/ThemeObject.loadCanvasPalette(LoadCanvasPaletteInput)` - shared Java-side mirror for the small set of CSS theme tokens that Canvas rendering needs.
- `ui/components/ThemeColors.controlSeparator()` - shared separator node helper for stacked control layouts.
- `ui/components/ThemeColors.applyDifficultyStyle(Label, String)` - shared difficulty label style helper that maps semantic difficulty names to CSS classes.

## Where New Code Goes

- Put Java-side mirrors of CSS theme tokens in `ui/theme`.
- Put reusable JavaFX helper nodes or small style helpers in `ui/components` when they are not owned by a product feature.
- Keep `resources/salt-marcher.css` as the single source of truth for theme tokens; mirror only the Canvas colors that Java code genuinely needs.

## Forbidden Drift

- Do not add new theme token constants back into `ui/components/ThemeColors`.
- Do not treat `ui/theme` as a home for general reusable components or CSS helper methods.
