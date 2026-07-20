package features.dungeon.application.editor;

import features.dungeon.api.editor.DungeonEditorPointerGesture;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolSelection;

final class DungeonEditorPointerWorkflowIntentResolver {
    private DungeonEditorPointerWorkflowIntentResolver() {
    }

    static PointerWorkflowIntent resolve(
            DungeonEditorToolSelection selection,
            DungeonEditorPointerGesture gesture
    ) {
        DungeonEditorPointerGesture safeGesture = gesture == null ? DungeonEditorPointerGesture.none() : gesture;
        DungeonEditorToolAction action = resolveAction(selection, safeGesture);
        if (action == null) {
            return PointerWorkflowIntent.ignored();
        }
        return new PointerWorkflowIntent(
                true,
                action,
                action.prefersBoundaryTargets(),
                action.wallSingleClickMode(safeGesture.controlDown()));
    }

    static PointerInteractionDecision resolveInteraction(
            PointerAction action,
            PointerWorkflowIntent intent,
            PointerInteractionCandidates candidates
    ) {
        PointerWorkflowIntent safeIntent = intent == null ? PointerWorkflowIntent.ignored() : intent;
        PointerInteractionCandidates safeCandidates = candidates == null
                ? PointerInteractionCandidates.empty()
                : candidates;
        if (!safeIntent.workflowAccepted()) {
            return PointerInteractionDecision.ignored();
        }
        PointerTargetChoice hoverChoice = hoverTargetChoice(safeIntent, safeCandidates.primaryTarget());
        PointerTargetChoice sampleChoice = sampleTargetChoice(action, safeIntent);
        return new PointerInteractionDecision(hoverChoice, sampleChoice);
    }

    private static PointerTargetChoice hoverTargetChoice(
            PointerWorkflowIntent intent,
            features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget
    ) {
        DungeonEditorToolAction tool = intent.toolAction();
        features.dungeon.api.editor.DungeonEditorPointerInput.Target safeTarget = safeTarget(primaryTarget);
        return switch (tool.family()) {
            case SELECT -> selectableHoverTarget(safeTarget)
                    ? PointerTargetChoice.primary()
                    : PointerTargetChoice.empty();
            case ROOM -> PointerTargetChoice.roomCellHover();
            case WALL -> intent.wallSingleClickMode()
                    ? wallSingleHoverTarget(safeTarget)
                    : PointerTargetChoice.wallVertexHover();
            case DOOR -> boundaryHoverTarget(safeTarget);
            case CORRIDOR -> corridorHoverTarget(safeTarget);
            default -> PointerTargetChoice.primary();
        };
    }

    private static PointerTargetChoice sampleTargetChoice(
            PointerAction action,
            PointerWorkflowIntent intent
    ) {
        DungeonEditorToolAction tool = intent.toolAction();
        if (tool.is(DungeonEditorToolFamily.TRANSITION, DungeonEditorToolAction.Operation.CREATE)) {
            return PointerTargetChoice.transitionPlacement();
        }
        if (tool.family() == DungeonEditorToolFamily.WALL) {
            return PointerTargetChoice.hoverTarget();
        }
        if (tool.isSelect() && PointerAction.isMoved(action)) {
            return PointerTargetChoice.hoverTarget();
        }
        return PointerTargetChoice.primary();
    }

    private static DungeonEditorToolAction resolveAction(
            DungeonEditorToolSelection selection,
            DungeonEditorPointerGesture gesture
    ) {
        DungeonEditorToolSelection safeSelection = selection == null
                ? DungeonEditorToolSelection.select()
                : selection;
        if (gesture.secondary() && gesture.shiftDown()) {
            return safeSelection.family() == DungeonEditorToolFamily.WALL
                    ? DungeonEditorToolAction.selected(safeSelection)
                    : null;
        }
        if (gesture.secondary()) {
            return safeSelection.family() == DungeonEditorToolFamily.SELECT
                    ? null
                    : DungeonEditorToolAction.delete(safeSelection);
        }
        return DungeonEditorToolAction.selected(safeSelection);
    }

    private static PointerTargetChoice wallSingleHoverTarget(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        return target.isBoundaryTarget() ? PointerTargetChoice.primary() : PointerTargetChoice.wallBoundaryHover();
    }

    private static PointerTargetChoice boundaryHoverTarget(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        return target.isBoundaryTarget() ? PointerTargetChoice.primary() : PointerTargetChoice.empty();
    }

    private static PointerTargetChoice corridorHoverTarget(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        if (target.isWallOrDoorBoundaryTarget()) {
            return PointerTargetChoice.primary();
        }
        return target.isCorridorCellTarget() ? PointerTargetChoice.primary() : PointerTargetChoice.empty();
    }

    private static boolean selectableHoverTarget(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        features.dungeon.api.editor.DungeonEditorPointerInput.Target safeTarget = safeTarget(target);
        if (safeTarget.hasSyntheticHover() || safeTarget.isRoomLabelTarget()) {
            return false;
        }
        return safeTarget.isHandleTarget()
                || safeTarget.isSelectableLabelTarget()
                || safeTarget.isSelectableMarkerTarget()
                || safeTarget.isGraphNodeTarget()
                || safeTarget.isSelectableCellTarget()
                || safeTarget.isDoorBoundaryTarget();
    }

    private static features.dungeon.api.editor.DungeonEditorPointerInput.Target safeTarget(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        return target == null ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty() : target;
    }
}
