package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorPointerWorkflowIntentResolver {
    private static final DungeonEditorToolRegistry TOOL_REGISTRY = DungeonEditorToolRegistry.current();

    private DungeonEditorPointerWorkflowIntentResolver() {
    }

    static PointerWorkflowIntent resolve(
            String selectedTool,
            PointerWorkflowGesture gesture
    ) {
        PointerWorkflowGesture safeGesture = gesture == null ? PointerWorkflowGesture.empty() : gesture;
        DungeonEditorTool effectiveTool = TOOL_REGISTRY.effectivePointerTool(
                selectedTool,
                safeGesture);
        if (effectiveTool == null) {
            return PointerWorkflowIntent.ignored();
        }
        return new PointerWorkflowIntent(
                true,
                effectiveTool,
                TOOL_REGISTRY.prefersBoundaryTargets(effectiveTool),
                TOOL_REGISTRY.wallSingleClickMode(effectiveTool, safeGesture));
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

    @SuppressWarnings("PMD.CyclomaticComplexity")
    private static PointerTargetChoice hoverTargetChoice(
            PointerWorkflowIntent intent,
            DungeonEditorRuntimePointerTarget primaryTarget
    ) {
        DungeonEditorTool tool = intent.effectiveTool();
        DungeonEditorRuntimePointerTarget safeTarget = safeTarget(primaryTarget);
        return switch (tool) {
            case SELECT -> selectableHoverTarget(safeTarget)
                    ? PointerTargetChoice.primary()
                    : PointerTargetChoice.empty();
            case ROOM_PAINT, ROOM_DELETE -> PointerTargetChoice.roomCellHover();
            case WALL_CREATE -> intent.wallSingleClickMode()
                    ? wallSingleHoverTarget(safeTarget)
                    : PointerTargetChoice.wallVertexHover();
            case WALL_DELETE, DOOR_CREATE, DOOR_DELETE -> boundaryHoverTarget(safeTarget);
            case CORRIDOR_CREATE, CORRIDOR_DELETE -> corridorHoverTarget(safeTarget);
            default -> PointerTargetChoice.primary();
        };
    }

    private static PointerTargetChoice sampleTargetChoice(
            PointerAction action,
            PointerWorkflowIntent intent
    ) {
        DungeonEditorTool tool = intent.effectiveTool();
        if (tool == DungeonEditorTool.TRANSITION_CREATE) {
            return PointerTargetChoice.transitionPlacement();
        }
        if (tool == DungeonEditorTool.WALL_CREATE) {
            return PointerTargetChoice.hoverTarget();
        }
        if (tool == DungeonEditorTool.SELECT && PointerAction.isMoved(action)) {
            return PointerTargetChoice.hoverTarget();
        }
        return PointerTargetChoice.primary();
    }

    private static PointerTargetChoice wallSingleHoverTarget(DungeonEditorRuntimePointerTarget target) {
        return target.isBoundaryTarget() ? PointerTargetChoice.primary() : PointerTargetChoice.wallBoundaryHover();
    }

    private static PointerTargetChoice boundaryHoverTarget(DungeonEditorRuntimePointerTarget target) {
        return target.isBoundaryTarget() ? PointerTargetChoice.primary() : PointerTargetChoice.empty();
    }

    private static PointerTargetChoice corridorHoverTarget(DungeonEditorRuntimePointerTarget target) {
        if (target.isWallOrDoorBoundaryTarget()) {
            return PointerTargetChoice.primary();
        }
        return target.isCorridorCellTarget() ? PointerTargetChoice.primary() : PointerTargetChoice.empty();
    }

    private static boolean selectableHoverTarget(DungeonEditorRuntimePointerTarget target) {
        DungeonEditorRuntimePointerTarget safeTarget = safeTarget(target);
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

    private static DungeonEditorRuntimePointerTarget safeTarget(DungeonEditorRuntimePointerTarget target) {
        return target == null ? DungeonEditorRuntimePointerTarget.empty() : target;
    }
}
