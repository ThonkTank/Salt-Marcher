package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSelectionUseCase;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolInput;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase.WorkflowAction;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.CellInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.HandleInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.HandleKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.PointerTargetInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TargetKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyRefInput;
import src.domain.dungeon.model.worldspace.usecase.MoveDungeonEditorHandleUseCase;
import src.domain.dungeon.published.ApplyDungeonEditorPointerCommand;
import src.domain.dungeon.published.DungeonEditorPointerCommand;
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
        applyToolWorkflowUseCase.apply(
                Mapping.toToolInput(command),
                Mapping.toWorkflowAction(command),
                Mapping.toMainViewInput(command));
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
                command.targetQ(),
                command.targetR()));
    }

    private static final class Mapping {

        private static MainViewInput toMainViewInput(DungeonEditorPointerCommand command) {
            return new MainViewInput(
                    command.pointerCanvasX(),
                    command.pointerCanvasY(),
                    command.pointerPrimaryButtonDown(),
                    command.pointerSecondaryButtonDown(),
                    toPointerTargetInput(command),
                    command.transitionDestinationTypeName(),
                    command.transitionDestinationMapId(),
                    command.transitionDestinationTileId(),
                    command.transitionDestinationTransitionId());
        }

        private static ToolInput toToolInput(ApplyDungeonEditorPointerCommand command) {
            return ToolInput.fromName(command.tool().name());
        }

        private static WorkflowAction toWorkflowAction(ApplyDungeonEditorPointerCommand command) {
            return switch (command.actionName()) {
                case "PRESSED" -> WorkflowAction.START;
                case "DRAGGED" -> WorkflowAction.CONTINUE;
                case "RELEASED" -> WorkflowAction.FINISH;
                case "MOVED" -> WorkflowAction.PREVIEW;
                default -> WorkflowAction.PREVIEW;
            };
        }

        private static PointerTargetInput toPointerTargetInput(DungeonEditorPointerCommand command) {
            return new PointerTargetInput(
                    TargetKindInput.fromName(command.pointerTargetKindName()),
                    TopologyKindInput.fromName(command.pointerElementKindName()),
                    command.pointerOwnerId(),
                    command.pointerClusterId(),
                    toTopologyRefInput(command.pointerTopologyKindName(), command.pointerTopologyId()),
                    toHandleInput(command),
                    toBoundaryInput(command));
        }

        private static TopologyRefInput toTopologyRefInput(String kindName, long id) {
            return new TopologyRefInput(
                    TopologyKindInput.fromName(kindName),
                    id);
        }

        private static HandleInput toHandleInput(DungeonEditorPointerCommand command) {
            return new HandleInput(
                    HandleKindInput.fromName(command.pointerHandleKindName()),
                    toTopologyRefInput(command.pointerHandleTopologyKindName(), command.pointerHandleTopologyId()),
                    command.pointerHandleOwnerId(),
                    command.pointerHandleClusterId(),
                    command.pointerHandleCorridorId(),
                    command.pointerHandleRoomId(),
                    command.pointerHandleIndex(),
                    toCellInput(
                            command.pointerHandleCellQ(),
                            command.pointerHandleCellR(),
                            command.pointerHandleCellLevel()),
                    command.pointerHandleDirection());
        }

        private static BoundaryInput toBoundaryInput(DungeonEditorPointerCommand command) {
            return new BoundaryInput(
                    BoundaryKindInput.fromName(command.pointerBoundaryKindName()),
                    command.pointerBoundaryKey(),
                    command.pointerBoundaryOwnerId(),
                    toTopologyRefInput(command.pointerBoundaryTopologyKindName(), command.pointerBoundaryTopologyId()),
                    toCellInput(
                            command.pointerBoundaryStartQ(),
                            command.pointerBoundaryStartR(),
                            command.pointerBoundaryStartLevel()),
                    toCellInput(
                            command.pointerBoundaryEndQ(),
                            command.pointerBoundaryEndR(),
                            command.pointerBoundaryEndLevel()));
        }

        private static CellInput toCellInput(int q, int r, int level) {
            return new CellInput(q, r, level);
        }

    }

}
