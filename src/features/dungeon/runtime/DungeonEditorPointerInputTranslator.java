package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.ToolInput;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.ToolWorkflowInput;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.BoundaryTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.HandleTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorPointerInputTranslator {

    private DungeonEditorPointerInputTranslator() {
    }

    static ToolWorkflowInput toolWorkflowInput(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        PointerSample safeSample = sample == null
                ? new PointerSample(0.0, 0.0, false, false, PointerTarget.empty())
                : sample;
        ToolInput selectedTool = DungeonEditorRuntimeEnumTranslator.tool(toolKey);
        DungeonEditorTool editorTool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        TransitionDestination safeDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
        return new ToolWorkflowInput(
                selectedTool,
                DungeonEditorRuntimeEnumTranslator.workflowAction(action),
                mainViewInput(safeSample, wallSingleClickMode, editorTool == DungeonEditorTool.DOOR_DELETE,
                        safeDestination));
    }

    static DungeonEditorMainViewInput mainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        PointerSample safeSample = sample == null
                ? new PointerSample(0.0, 0.0, false, false, PointerTarget.empty())
                : sample;
        TransitionDestination safeDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
        return new DungeonEditorMainViewInput(
                safeSample.sceneX(),
                safeSample.sceneY(),
                safeSample.primaryButtonDown(),
                safeSample.secondaryButtonDown(),
                wallSingleClickMode,
                plainPointerTarget(safeSample.target()),
                safeDestination);
    }

    static DungeonEditorMainViewInput mainViewInput(
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        PointerSample safeSample = sample == null
                ? new PointerSample(0.0, 0.0, false, false, PointerTarget.empty())
                : sample;
        DungeonEditorTool selectedTool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        TransitionDestination safeDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
        return mainViewInput(safeSample, wallSingleClickMode, selectedTool == DungeonEditorTool.DOOR_DELETE,
                safeDestination);
    }

    private static DungeonEditorMainViewInput mainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            boolean doorDeleteSelected,
            TransitionDestination transitionDestination
    ) {
        return new DungeonEditorMainViewInput(
                sample.sceneX(),
                sample.sceneY(),
                sample.primaryButtonDown(),
                sample.secondaryButtonDown(),
                wallSingleClickMode,
                pointerTarget(sample.target(), doorDeleteSelected),
                transitionDestination);
    }

    private static DungeonEditorMainViewPointerTarget pointerTarget(PointerTarget target, boolean doorDeleteSelected) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        DungeonEditorMainViewPointerTarget doorDeleteTarget = doorDeleteBoundaryTarget(safeTarget, doorDeleteSelected);
        return doorDeleteTarget == null ? plainPointerTarget(safeTarget) : doorDeleteTarget;
    }

    private static DungeonEditorMainViewPointerTarget plainPointerTarget(PointerTarget target) {
        return switch (DungeonEditorRuntimeEnumTranslator.normalizedEnumName(target.targetKind())) {
            case "CELL" -> DungeonEditorMainViewPointerTarget.cell(
                    DungeonEditorRuntimeEnumTranslator.topologyKind(target.elementKind()),
                    target.ownerId(),
                    target.clusterId(),
                    DungeonEditorRuntimeInputValues.topologyRef(target.topologyKind(), target.topologyId()));
            case "LABEL" -> DungeonEditorMainViewPointerTarget.label(
                    target.ownerId(),
                    target.clusterId(),
                    DungeonEditorRuntimeInputValues.topologyRef(target.topologyKind(), target.topologyId()),
                    DungeonEditorRuntimeEnumTranslator.labelKind(target.labelKind()));
            case "GRAPH_NODE" -> DungeonEditorMainViewPointerTarget.graphNode(
                    target.ownerId(),
                    target.clusterId(),
                    DungeonEditorRuntimeInputValues.topologyRef(target.topologyKind(), target.topologyId()));
            case "HANDLE" -> DungeonEditorMainViewPointerTarget.handle(
                    DungeonEditorHandleInputTranslator.handleRef(target.handle()));
            case "BOUNDARY" -> boundaryTarget(target.boundary());
            default -> DungeonEditorMainViewPointerTarget.empty();
        };
    }

    private static DungeonEditorMainViewPointerTarget doorDeleteBoundaryTarget(
            PointerTarget target,
            boolean doorDeleteSelected
    ) {
        HandleTarget handle = target.handle();
        if (!doorDeleteSelected
                || !"HANDLE".equals(DungeonEditorRuntimeEnumTranslator.normalizedEnumName(target.targetKind()))
                || !"DOOR".equals(DungeonEditorRuntimeEnumTranslator.normalizedEnumName(handle.kind()))
                || !handle.sourceEdgePresent()) {
            return null;
        }
        return DungeonEditorMainViewPointerTarget.boundary(
                DungeonEditorWorkspaceValues.BoundaryKind.DOOR,
                "",
                handle.ownerId(),
                DungeonEditorRuntimeInputValues.topologyRef(handle.topologyKind(), handle.topologyId()),
                DungeonEditorRuntimeInputValues.cell(
                        handle.sourceStartQ(),
                        handle.sourceStartR(),
                        handle.sourceStartLevel()),
                DungeonEditorRuntimeInputValues.cell(
                        handle.sourceEndQ(),
                        handle.sourceEndR(),
                        handle.sourceEndLevel()));
    }

    private static DungeonEditorMainViewPointerTarget boundaryTarget(BoundaryTarget boundary) {
        BoundaryTarget safeBoundary = boundary == null ? BoundaryTarget.empty() : boundary;
        return DungeonEditorMainViewPointerTarget.boundary(
                DungeonEditorRuntimeEnumTranslator.boundaryKind(safeBoundary.kind()),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                DungeonEditorRuntimeInputValues.topologyRef(safeBoundary.topologyKind(), safeBoundary.topologyId()),
                DungeonEditorRuntimeInputValues.cell(
                        safeBoundary.startQ(),
                        safeBoundary.startR(),
                        safeBoundary.startLevel()),
                DungeonEditorRuntimeInputValues.cell(
                        safeBoundary.endQ(),
                        safeBoundary.endR(),
                        safeBoundary.endLevel()));
    }
}
