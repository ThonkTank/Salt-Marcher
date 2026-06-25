package src.features.dungeon.runtime;

public record PointerInteractionTargets(
        double sceneX,
        double sceneY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        DungeonEditorRuntimePointerTarget primaryTarget,
        DungeonEditorRuntimePointerTarget boundaryPreferredTarget,
        DungeonEditorRuntimePointerTarget wallBoundaryHoverTarget
) {
    public PointerInteractionTargets {
        sceneX = finiteOrZero(sceneX);
        sceneY = finiteOrZero(sceneY);
        primaryTarget = primaryTarget == null ? DungeonEditorRuntimePointerTarget.empty() : primaryTarget;
        boundaryPreferredTarget = boundaryPreferredTarget == null
                ? primaryTarget
                : boundaryPreferredTarget;
        wallBoundaryHoverTarget = wallBoundaryHoverTarget == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : wallBoundaryHoverTarget;
    }

    public static PointerInteractionTargets empty() {
        return new PointerInteractionTargets(
                0.0,
                0.0,
                false,
                false,
                DungeonEditorRuntimePointerTarget.empty(),
                DungeonEditorRuntimePointerTarget.empty(),
                DungeonEditorRuntimePointerTarget.empty());
    }

    DungeonEditorRuntimePointerTarget primaryTarget(boolean boundaryPreferred) {
        return boundaryPreferred ? boundaryPreferredTarget : primaryTarget;
    }

    private static double finiteOrZero(double value) {
        return Double.isFinite(value) ? value : 0.0;
    }
}
