package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorPointerSamplePolicy {
    private DungeonEditorPointerSamplePolicy() {
    }

    static PointerSample pointerSample(
            PointerInteractionTargets targets,
            DungeonEditorRuntimePointerTarget target,
            PointerWorkflowIntent intent
    ) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        return new PointerSample(
                sampleSceneX(targets, safeTarget, intent),
                sampleSceneY(targets, safeTarget, intent),
                targets.primaryButtonDown(),
                targets.secondaryButtonDown(),
                safeTarget);
    }

    static DungeonEditorRuntimePointerTarget pointerTargetChoice(
            PointerTargetChoice choice,
            PointerInteractionTargets targets,
            DungeonEditorRuntimePointerTarget primaryTarget,
            DungeonEditorRuntimePointerTarget hoverTarget,
            int projectionLevel
    ) {
        PointerInteractionTargets safeTargets = targets == null ? PointerInteractionTargets.empty() : targets;
        return PointerTargetChoice.safe(choice).target(
                safeTargets,
                primaryTarget,
                hoverTarget,
                projectionLevel);
    }

    private static double sampleSceneX(
            PointerInteractionTargets targets,
            DungeonEditorRuntimePointerTarget target,
            PointerWorkflowIntent intent
    ) {
        if (intent.effectiveTool() != DungeonEditorTool.WALL_CREATE) {
            return targets.sceneX();
        }
        if (intent.wallSingleClickMode() && target.isBoundaryTarget()) {
            return target.boundary().startQ();
        }
        if (target.isVertexTarget()) {
            return target.vertexQ();
        }
        return targets.sceneX();
    }

    private static double sampleSceneY(
            PointerInteractionTargets targets,
            DungeonEditorRuntimePointerTarget target,
            PointerWorkflowIntent intent
    ) {
        if (intent.effectiveTool() != DungeonEditorTool.WALL_CREATE) {
            return targets.sceneY();
        }
        if (intent.wallSingleClickMode() && target.isBoundaryTarget()) {
            return target.boundary().startR();
        }
        if (target.isVertexTarget()) {
            return target.vertexR();
        }
        return targets.sceneY();
    }

}
