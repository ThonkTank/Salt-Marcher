package features.encounter.ui;

import features.encounter.service.EncounterService;
import ui.shell.SceneRegistry;

import java.util.function.Consumer;

/**
 * Required cross-view callbacks for EncounterView, injected at construction time.
 * Enforces at compile time that all dependencies are wired before the view is used.
 */
public record EncounterViewCallbacks(
        Runnable onRefreshToolbar,
        Runnable onRefreshPanels,
        Consumer<Long> onRequestStatBlock,
        SceneRegistry sceneRegistry,
        EncounterService encounterService) {}
