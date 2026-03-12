package features.encounter.ui;

import features.encounter.builder.application.EncounterBuilderService;
import features.encounter.combat.application.EncounterCombatService;
import ui.shell.DetailsNavigator;
import ui.shell.SceneRegistry;

/**
 * Required cross-view callbacks for EncounterView, injected at construction time.
 * Enforces at compile time that all dependencies are wired before the view is used.
 */
public record EncounterViewCallbacks(
        Runnable onRefreshToolbar,
        Runnable onRefreshPanels,
        DetailsNavigator detailsNavigator,
        SceneRegistry sceneRegistry,
        EncounterBuilderService builderService,
        EncounterCombatService combatService) {}
