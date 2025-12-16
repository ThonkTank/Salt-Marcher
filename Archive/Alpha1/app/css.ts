// src/app/css.ts
// Bündelt globale Styles für Plugin-Views inkl. Bibliotheks-Editoren.
// Abschnitte getrennt halten, damit einzelne Bereiche gezielt ergänzt werden können.
//
// Split from monolithic 7,260 line file into modular CSS files in src/app/styles/
// See: src/app/styles/ for individual style modules

import {
    viewContainerCss,
    mapAndPreviewCss,
    terrainEditorCss,
    libraryViewCss,
    createModalCss,
    cartographerShellCss,
    cartographerPanelsCss,
    travelModeCss,
    sessionRunnerCss,
    presetsCss,
    dataManagerCss,
    encounterCss,
    combatTrackerCss,
    tabNavigationCss,
    almanacCss,
} from "./styles";

// Exportiert alle Module einzeln, um gezielt überschrieben oder getestet zu werden.
export const HEX_PLUGIN_CSS_SECTIONS = {
    viewContainer: viewContainerCss,
    mapAndPreview: mapAndPreviewCss,
    terrainEditor: terrainEditorCss,
    libraryView: libraryViewCss,
    createModal: createModalCss,
    cartographerShell: cartographerShellCss,
    cartographerPanels: cartographerPanelsCss,
    travelMode: travelModeCss,
    sessionRunner: sessionRunnerCss,
    presets: presetsCss,
    dataManager: dataManagerCss,
    encounter: encounterCss,
    combatTracker: combatTrackerCss,
    tabNavigation: tabNavigationCss,
    almanac: almanacCss
} as const;

export const HEX_PLUGIN_CSS = Object.values(HEX_PLUGIN_CSS_SECTIONS).join("\n\n");
