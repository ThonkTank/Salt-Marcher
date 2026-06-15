package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSelectionUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolInput;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolWorkflowInput;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.WorkflowAction;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.CellInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.HandleInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.HandleKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.LabelKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.PointerTargetInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TargetKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyRefInput;
import src.domain.dungeon.model.runtime.usecase.MoveDungeonEditorHandleUseCase;
import src.domain.dungeon.published.ApplyDungeonEditorPointerCommand;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorBoundaryTargetRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorPointerSample;
import src.domain.dungeon.published.DungeonEditorPointerTarget;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.MoveDungeonEditorHandleCommand;
import src.domain.dungeon.published.ShiftDungeonEditorProjectionLevelCommand;

public final class DungeonEditorPointerApplicationService {

    private final ApplyDungeonEditorToolWorkflowUseCase applyToolWorkflowUseCase;
    private final ApplyDungeonEditorSelectionUseCase applySelectionUseCase;
    private final MoveDungeonEditorHandleUseCase moveHandleUseCase;

    DungeonEditorPointerApplicationService(
            ApplyDungeonEditorToolWorkflowUseCase applyToolWorkflowUseCase,
            ApplyDungeonEditorSelectionUseCase applySelectionUseCase,
            MoveDungeonEditorHandleUseCase moveHandleUseCase
    ) {
        this.applyToolWorkflowUseCase = Objects.requireNonNull(
                applyToolWorkflowUseCase,
                "applyToolWorkflowUseCase");
        this.applySelectionUseCase = Objects.requireNonNull(applySelectionUseCase, "applySelectionUseCase");
        this.moveHandleUseCase = Objects.requireNonNull(moveHandleUseCase, "moveHandleUseCase");
    }

    public void applyPointer(ApplyDungeonEditorPointerCommand command) {
        Objects.requireNonNull(command, "command");
        applyToolWorkflowUseCase.apply(toWorkflowInput(command));
    }

    public void scrollSelection(ShiftDungeonEditorProjectionLevelCommand command) {
        Objects.requireNonNull(command, "command");
        applySelectionUseCase.scroll(command.projectionLevelDelta());
    }

    public void moveHandle(MoveDungeonEditorHandleCommand command) {
        Objects.requireNonNull(command, "command");
        if (!command.hasHandleRef()) {
            return;
        }
        moveHandleUseCase.execute(new MoveDungeonEditorHandleUseCase.HandleMoveInput(
                command.handleKindName(),
                command.handleTopologyKindName(),
                command.handleTopologyId(),
                command.handleOwnerId(),
                command.handleClusterId(),
                command.handleCorridorId(),
                command.handleRoomId(),
                command.handleIndex(),
                command.handleCellQ(),
                command.handleCellR(),
                command.handleCellLevel(),
                command.handleDirection(),
                command.handleSourceEdgeFromQ(),
                command.handleSourceEdgeFromR(),
                command.handleSourceEdgeFromLevel(),
                command.handleSourceEdgeToQ(),
                command.handleSourceEdgeToR(),
                command.handleSourceEdgeToLevel(),
                command.targetQ(),
                command.targetR()));
    }

    private static TopologyRefInput topologyRefInput(String kindName, long id) {
        return new TopologyRefInput(
                TopologyKindInput.fromName(kindName),
                id);
    }

    private static CellInput cellInput(int q, int r, int level) {
        return new CellInput(q, r, level);
    }

    private static WorkflowAction workflowAction(String actionName) {
        return switch (actionName) {
            case "PRESSED" -> WorkflowAction.START;
            case "DRAGGED" -> WorkflowAction.CONTINUE;
            case "RELEASED" -> WorkflowAction.FINISH;
            case "MOVED" -> WorkflowAction.PREVIEW;
            default -> WorkflowAction.PREVIEW;
        };
    }

    private static ToolWorkflowInput toWorkflowInput(ApplyDungeonEditorPointerCommand command) {
        DungeonEditorPointerSample pointer = command.pointer();
        DungeonEditorPointerTarget target = pointer.target();
        DungeonTopologyElementRef targetTopology = target.topologyRef();
        DungeonEditorHandleRef handle = target.handleRef();
        DungeonTopologyElementRef handleTopology = handle.topologyRef();
        DungeonCellRef handleCell = handle.cell();
        DungeonEdgeRef sourceEdge = handle.sourceEdge();
        BoundaryInput sourceEdgeInput = sourceEdge == null || sourceEdge.from() == null || sourceEdge.to() == null
                ? BoundaryInput.empty()
                : boundaryInput(
                        "WALL",
                        "",
                        handle.ownerId(),
                        topologyRefInput(handleTopology.kind().name(), handleTopology.id()),
                        cellInput(sourceEdge.from().q(), sourceEdge.from().r(), sourceEdge.from().level()),
                        cellInput(sourceEdge.to().q(), sourceEdge.to().r(), sourceEdge.to().level()));
        DungeonEditorBoundaryTargetRef boundary = target.boundaryRef();
        DungeonTopologyElementRef boundaryTopology = boundary.topologyRef();
        DungeonCellRef boundaryStart = boundary.start();
        DungeonCellRef boundaryEnd = boundary.end();
        MainViewInput mainViewInput = new MainViewInput(
                pointer.canvasX(),
                pointer.canvasY(),
                pointer.primaryButtonDown(),
                pointer.secondaryButtonDown(),
                command.wallSingleClickMode(),
                new PointerTargetInput(
                        TargetKindInput.fromName(target.targetKind().name()),
                        LabelKindInput.fromName(target.labelKind().name()),
                        TopologyKindInput.fromName(target.elementKind().name()),
                        target.ownerId(),
                        target.clusterId(),
                        topologyRefInput(targetTopology.kind().name(), targetTopology.id()),
                        new HandleInput(
                                HandleKindInput.fromName(handle.kind().name()),
                                topologyRefInput(handleTopology.kind().name(), handleTopology.id()),
                                handle.ownerId(),
                                handle.clusterId(),
                                handle.corridorId(),
                                handle.roomId(),
                                handle.index(),
                                cellInput(handleCell.q(), handleCell.r(), handleCell.level()),
                                handle.direction(),
                                sourceEdgeInput),
                        boundaryInput(
                                boundary.kind().name(),
                                boundary.key(),
                                boundary.ownerId(),
                                topologyRefInput(boundaryTopology.kind().name(), boundaryTopology.id()),
                                cellInput(boundaryStart.q(), boundaryStart.r(), boundaryStart.level()),
                                cellInput(boundaryEnd.q(), boundaryEnd.r(), boundaryEnd.level()))),
                command.transitionDestinationTypeName(),
                command.transitionDestinationMapId(),
                command.transitionDestinationTileId(),
                command.transitionDestinationTransitionId());
        return new ToolWorkflowInput(
                ToolInput.fromName(command.tool().name()),
                workflowAction(command.actionName()),
                mainViewInput);
    }

    private static BoundaryInput boundaryInput(
            String kindName,
            String key,
            long ownerId,
            TopologyRefInput topologyRef,
            CellInput start,
            CellInput end
    ) {
        return new BoundaryInput(
                BoundaryKindInput.fromName(kindName),
                key,
                ownerId,
                topologyRef,
                start,
                end);
    }
}
