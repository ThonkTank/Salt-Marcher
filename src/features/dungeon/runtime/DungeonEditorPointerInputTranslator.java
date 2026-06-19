package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolInput;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolWorkflowInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.HandleInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.LabelKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.PointerTargetInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TargetKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyRefInput;
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
        TransitionDestination safeDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
        return new ToolWorkflowInput(
                selectedTool,
                DungeonEditorRuntimeEnumTranslator.workflowAction(action),
                mainViewInput(safeSample, wallSingleClickMode, selectedTool, safeDestination));
    }

    private static MainViewInput mainViewInput(
            PointerSample sample,
            boolean wallSingleClickMode,
            ToolInput selectedTool,
            TransitionDestination transitionDestination
    ) {
        return new MainViewInput(
                sample.sceneX(),
                sample.sceneY(),
                sample.primaryButtonDown(),
                sample.secondaryButtonDown(),
                wallSingleClickMode,
                pointerTarget(sample.target(), selectedTool),
                transitionDestination.destinationType(),
                transitionDestination.targetMapId(),
                transitionDestination.targetTileId(),
                transitionDestination.targetTransitionId());
    }

    private static PointerTargetInput pointerTarget(PointerTarget target, ToolInput selectedTool) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        PointerTargetInput doorDeleteTarget = doorDeleteBoundaryTarget(safeTarget, selectedTool);
        return doorDeleteTarget == null ? plainPointerTarget(safeTarget) : doorDeleteTarget;
    }

    private static PointerTargetInput plainPointerTarget(PointerTarget target) {
        return switch (DungeonEditorRuntimeEnumTranslator.normalizedEnumName(target.targetKind())) {
            case "CELL" -> new PointerTargetInput(
                    TargetKindInput.CELL,
                    LabelKindInput.EMPTY,
                    DungeonEditorRuntimeEnumTranslator.topologyKind(target.elementKind()),
                    target.ownerId(),
                    target.clusterId(),
                    DungeonEditorRuntimeInputValues.topologyRef(target.topologyKind(), target.topologyId()),
                    HandleInput.empty(),
                    BoundaryInput.empty());
            case "LABEL" -> new PointerTargetInput(
                    TargetKindInput.LABEL,
                    DungeonEditorRuntimeEnumTranslator.labelKind(target.labelKind()),
                    TopologyKindInput.EMPTY,
                    target.ownerId(),
                    target.clusterId(),
                    DungeonEditorRuntimeInputValues.topologyRef(target.topologyKind(), target.topologyId()),
                    HandleInput.empty(),
                    BoundaryInput.empty());
            case "GRAPH_NODE" -> new PointerTargetInput(
                    TargetKindInput.GRAPH_NODE,
                    LabelKindInput.EMPTY,
                    TopologyKindInput.EMPTY,
                    target.ownerId(),
                    target.clusterId(),
                    DungeonEditorRuntimeInputValues.topologyRef(target.topologyKind(), target.topologyId()),
                    HandleInput.empty(),
                    BoundaryInput.empty());
            case "HANDLE" -> new PointerTargetInput(
                    TargetKindInput.HANDLE,
                    LabelKindInput.EMPTY,
                    TopologyKindInput.EMPTY,
                    target.ownerId(),
                    target.clusterId(),
                    TopologyRefInput.empty(),
                    DungeonEditorHandleInputTranslator.handleInput(target.handle()),
                    BoundaryInput.empty());
            case "BOUNDARY" -> new PointerTargetInput(
                    TargetKindInput.BOUNDARY,
                    LabelKindInput.EMPTY,
                    TopologyKindInput.EMPTY,
                    target.ownerId(),
                    target.clusterId(),
                    TopologyRefInput.empty(),
                    HandleInput.empty(),
                    boundaryInput(target.boundary()));
            default -> PointerTargetInput.empty();
        };
    }

    private static PointerTargetInput doorDeleteBoundaryTarget(PointerTarget target, ToolInput selectedTool) {
        HandleTarget handle = target.handle();
        if (selectedTool != ToolInput.DOOR_DELETE
                || !"HANDLE".equals(DungeonEditorRuntimeEnumTranslator.normalizedEnumName(target.targetKind()))
                || !"DOOR".equals(DungeonEditorRuntimeEnumTranslator.normalizedEnumName(handle.kind()))
                || !handle.sourceEdgePresent()) {
            return null;
        }
        return new PointerTargetInput(
                TargetKindInput.BOUNDARY,
                LabelKindInput.EMPTY,
                TopologyKindInput.EMPTY,
                target.ownerId(),
                target.clusterId(),
                TopologyRefInput.empty(),
                HandleInput.empty(),
                new BoundaryInput(
                        BoundaryKindInput.DOOR,
                        "",
                        handle.ownerId(),
                        DungeonEditorRuntimeInputValues.topologyRef(handle.topologyKind(), handle.topologyId()),
                        DungeonEditorRuntimeInputValues.cellInput(
                                handle.sourceStartQ(),
                                handle.sourceStartR(),
                                handle.sourceStartLevel()),
                        DungeonEditorRuntimeInputValues.cellInput(
                                handle.sourceEndQ(),
                                handle.sourceEndR(),
                                handle.sourceEndLevel())));
    }

    private static BoundaryInput boundaryInput(BoundaryTarget boundary) {
        BoundaryTarget safeBoundary = boundary == null ? BoundaryTarget.empty() : boundary;
        return new BoundaryInput(
                DungeonEditorRuntimeEnumTranslator.boundaryKind(safeBoundary.kind()),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                DungeonEditorRuntimeInputValues.topologyRef(safeBoundary.topologyKind(), safeBoundary.topologyId()),
                DungeonEditorRuntimeInputValues.cellInput(
                        safeBoundary.startQ(),
                        safeBoundary.startR(),
                        safeBoundary.startLevel()),
                DungeonEditorRuntimeInputValues.cellInput(
                        safeBoundary.endQ(),
                        safeBoundary.endR(),
                        safeBoundary.endLevel()));
    }
}
