package features.encounter.api;

import features.encounter.builder.application.EncounterBuilderService;
import features.encounter.combat.application.EncounterCombatService;
import ui.shell.SceneRegistry;
import ui.components.creatures.statblock.StatBlockRequest;

import java.util.function.Consumer;

/**
 * Required cross-view callbacks for EncounterView, injected at construction time.
 * Enforces at compile time that all dependencies are wired before the view is used.
 */
public record EncounterViewCallbacks(
        Runnable onRefreshToolbar,
        Runnable onRefreshPanels,
        Consumer<StatBlockRequest> onRequestStatBlock,
        SceneRegistry sceneRegistry,
        EncounterBuilderService builderService,
        EncounterCombatService combatService) {}
