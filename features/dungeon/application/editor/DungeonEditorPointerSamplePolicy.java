package features.dungeon.application.editor;

import features.dungeon.api.editor.DungeonEditorToolFamily;

final class DungeonEditorPointerSamplePolicy {
    private DungeonEditorPointerSamplePolicy() {
    }

    static PointerSample pointerSample(
            PointerInteractionTargets targets,
            features.dungeon.api.editor.DungeonEditorPointerInput.Target target,
            PointerWorkflowIntent intent
    ) {
        features.dungeon.api.editor.DungeonEditorPointerInput.Target safeTarget = target == null
                ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty()
                : target;
        return new PointerSample(
                sampleSceneX(targets, safeTarget, intent),
                sampleSceneY(targets, safeTarget, intent),
                targets.primaryButtonDown(),
                targets.secondaryButtonDown(),
                safeTarget);
    }

    static features.dungeon.api.editor.DungeonEditorPointerInput.Target pointerTargetChoice(
            PointerTargetChoice choice,
            PointerInteractionTargets targets,
            features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
            features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget,
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
            features.dungeon.api.editor.DungeonEditorPointerInput.Target target,
            PointerWorkflowIntent intent
    ) {
        if (intent.toolAction().family() != DungeonEditorToolFamily.WALL) {
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
            features.dungeon.api.editor.DungeonEditorPointerInput.Target target,
            PointerWorkflowIntent intent
    ) {
        if (intent.toolAction().family() != DungeonEditorToolFamily.WALL) {
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
