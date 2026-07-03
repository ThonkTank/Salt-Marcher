package src.features.dungeon.runtime;

record DungeonEditorMainViewInput(
        double canvasX,
        double canvasY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        boolean wallSingleClickMode,
        boolean doorDeleteSelected,
        DungeonEditorRuntimePointerTarget boundaryInputTarget,
        TransitionDestination transitionDestination
) {
    DungeonEditorMainViewInput {
        boundaryInputTarget = boundaryInputTarget == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : boundaryInputTarget;
        transitionDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
    }

    DungeonEditorRuntimePointerTarget target() {
        if (!doorDeleteSelected) {
            return boundaryInputTarget;
        }
        return DungeonEditorMainViewInputBoundaryTranslationHelper.doorDeleteBoundaryTarget(boundaryInputTarget);
    }

    static DungeonEditorMainViewInput empty() {
        return new DungeonEditorMainViewInput(
                0.0,
                0.0,
                false,
                false,
                false,
                false,
                DungeonEditorRuntimePointerTarget.empty(),
                TransitionDestination.empty());
    }
}
