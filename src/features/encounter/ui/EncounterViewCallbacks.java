package features.encounter.ui;

import features.encounter.builder.application.EncounterBuilderService;
import features.encounter.combat.application.EncounterCombatService;
import features.creatures.api.StatBlockRequest;
import ui.shell.SceneRegistry;

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
