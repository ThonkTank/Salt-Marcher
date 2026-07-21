package features.dungeon.application.editor;

record DungeonEditorMainViewInput(
        double canvasX,
        double canvasY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        boolean wallSingleClickMode,
        boolean doorDeleteSelected,
        features.dungeon.api.editor.DungeonEditorPointerInput.Target boundaryInputTarget,
        TransitionDestination transitionDestination
) {
    DungeonEditorMainViewInput {
        boundaryInputTarget = boundaryInputTarget == null
                ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty()
                : boundaryInputTarget;
        transitionDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
    }

    features.dungeon.api.editor.DungeonEditorPointerInput.Target target() {
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
                features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty(),
                TransitionDestination.empty());
    }

    static DungeonEditorMainViewInput fromPointer(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return fromPointer(sample, wallSingleClickMode, false, transitionDestination);
    }

    static DungeonEditorMainViewInput fromPointer(
            PointerSample sample,
            boolean wallSingleClickMode,
            boolean doorDeleteSelected,
            TransitionDestination transitionDestination
    ) {
        PointerSample safeSample = sample == null
                ? new PointerSample(
                        0.0,
                        0.0,
                        false,
                        false,
                        features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty())
                : sample;
        return new DungeonEditorMainViewInput(
                safeSample.sceneX(),
                safeSample.sceneY(),
                safeSample.primaryButtonDown(),
                safeSample.secondaryButtonDown(),
                wallSingleClickMode,
                doorDeleteSelected,
                safeSample.target(),
                transitionDestination);
    }
}
