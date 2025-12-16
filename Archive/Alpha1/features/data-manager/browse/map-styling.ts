// src/features/data-manager/browse/map-styling.ts
// Facade for map-related styling functionality
//
// This module isolates the external dependency on ui/maps/workflows,
// providing a single point of control for map-related styling in browse views.
// Makes it easier to replace or mock the implementation in the future.

export { applyMapButtonStyle } from "@ui/maps/workflows/map-workflows";
