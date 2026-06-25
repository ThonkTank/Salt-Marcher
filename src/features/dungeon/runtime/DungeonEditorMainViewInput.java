package src.features.dungeon.runtime;


record DungeonEditorMainViewInput(
        double canvasX,
        double canvasY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        boolean wallSingleClickMode,
        DungeonEditorMainViewPointerTarget target,
        TransitionDestination transitionDestination
) {
    DungeonEditorMainViewInput {
        target = target == null ? DungeonEditorMainViewPointerTarget.empty() : target;
        transitionDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
    }

    static DungeonEditorMainViewInput empty() {
        return new DungeonEditorMainViewInput(
                0.0,
                0.0,
                false,
                false,
                false,
                DungeonEditorMainViewPointerTarget.empty(),
                TransitionDestination.empty());
    }
}
