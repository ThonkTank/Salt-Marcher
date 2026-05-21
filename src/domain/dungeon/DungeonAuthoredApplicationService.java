package src.domain.dungeon;

import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_CREATE_CORRIDOR;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_DELETE_CORRIDOR;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_EDIT_CLUSTER_BOUNDARIES;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_EXTEND_CORRIDOR;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_MERGE_CORRIDORS;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_MOVE_BOUNDARY_STRETCH;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_MOVE_EDITOR_HANDLE;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_MOVE_ROOM_ANCHOR;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_MOVE_TOPOLOGY_ELEMENT;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_NOOP;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_ROOM_RECTANGLE;
import static src.domain.dungeon.published.DungeonAuthoredMutationCommand.OPERATION_SAVE_ROOM_NARRATION;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.map.usecase.RefreshDungeonAuthoredUseCase;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;

/**
 * Public authored-dungeon backend boundary for reads and mutations.
 */
@SuppressWarnings("PMD.TooManyMethods")
public final class DungeonAuthoredApplicationService {

    private static final String DEFAULT_DIRECTION = "";
    private static final String PREVIEW_ACTION = "PREVIEW";
    private static final String ANCHOR_ENDPOINT = "ANCHOR";

    private final RefreshDungeonAuthoredUseCase refreshDungeonAuthoredUseCase;
    private final ApplyDungeonAuthoredMutationUseCase applyDungeonAuthoredMutationUseCase;

    public DungeonAuthoredApplicationService(
            RefreshDungeonAuthoredUseCase refreshDungeonAuthoredUseCase,
            ApplyDungeonAuthoredMutationUseCase applyDungeonAuthoredMutationUseCase
    ) {
        this.refreshDungeonAuthoredUseCase =
                Objects.requireNonNull(refreshDungeonAuthoredUseCase, "refreshDungeonAuthoredUseCase");
        this.applyDungeonAuthoredMutationUseCase =
                Objects.requireNonNull(applyDungeonAuthoredMutationUseCase, "applyDungeonAuthoredMutationUseCase");
    }

    public void refreshAuthored(DungeonAuthoredReadCommand command) {
        refreshDungeonAuthoredUseCase.execute(toReadInput(command));
    }

    public void mutateAuthored(DungeonAuthoredMutationCommand command) {
        applyDungeonAuthoredMutationUseCase.execute(toMutationInput(command));
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static RefreshDungeonAuthoredUseCase.ReadInput toReadInput(DungeonAuthoredReadCommand command) {
        Objects.requireNonNull(command, "command");
        return new RefreshDungeonAuthoredUseCase.ReadInput(
                command.describesSelection()
                        ? RefreshDungeonAuthoredUseCase.ReadActionInput.DESCRIBE_SELECTION
                        : RefreshDungeonAuthoredUseCase.ReadActionInput.MAP_SELECTION,
                command.mapIdValue(),
                topologyRef(command.topologyKindName(), command.topologyId()),
                command.clusterIdValue(),
                command.clusterSelectionValue());
    }

    private static ApplyDungeonAuthoredMutationUseCase.MutationInput toMutationInput(
            DungeonAuthoredMutationCommand command
    ) {
        Objects.requireNonNull(command, "command");
        return new ApplyDungeonAuthoredMutationUseCase.MutationInput(
                toActionInput(command),
                command.mapIdValue(),
                toOperationInput(command));
    }

    private static ApplyDungeonAuthoredMutationUseCase.ActionInput toActionInput(
            DungeonAuthoredMutationCommand command
    ) {
        return PREVIEW_ACTION.equals(command.actionName())
                ? ApplyDungeonAuthoredMutationUseCase.ActionInput.PREVIEW
                : ApplyDungeonAuthoredMutationUseCase.ActionInput.APPLY;
    }

    @SuppressWarnings({"PMD.CyclomaticComplexity", "PMD.LawOfDemeter"})
    private static ApplyDungeonAuthoredMutationUseCase.OperationInput toOperationInput(
            DungeonAuthoredMutationCommand command
    ) {
        return switch (command.operationKindName()) {
            case OPERATION_MOVE_TOPOLOGY_ELEMENT -> moveTopologyElementInput(
                    command.topologyKindName(),
                    command.topologyId(),
                    command.deltaQ(),
                    command.deltaR(),
                    command.deltaLevel());
            case OPERATION_MOVE_EDITOR_HANDLE -> toMoveEditorHandleInput(command);
            case OPERATION_MOVE_BOUNDARY_STRETCH -> toMoveBoundaryStretchInput(command);
            case OPERATION_MOVE_ROOM_ANCHOR -> new ApplyDungeonAuthoredMutationUseCase.MoveRoomAnchorInput(
                    command.deltaQ(),
                    command.deltaR());
            case OPERATION_ROOM_RECTANGLE -> new ApplyDungeonAuthoredMutationUseCase.RoomRectangleInput(
                    command.rectangleActionName(),
                    cell(command.startCellQ(), command.startCellR(), command.startCellLevel()),
                    cell(command.endCellQ(), command.endCellR(), command.endCellLevel()));
            case OPERATION_EDIT_CLUSTER_BOUNDARIES -> toEditClusterBoundariesInput(command);
            case OPERATION_CREATE_CORRIDOR -> new ApplyDungeonAuthoredMutationUseCase.CreateCorridorInput(
                    corridorEndpoint(
                            command.endpointKindName(true),
                            command.endpointHostCorridorId(true),
                            command.endpointRoomId(true),
                            command.endpointClusterId(true),
                            command.endpointCellQ(true),
                            command.endpointCellR(true),
                            command.endpointCellLevel(true),
                            command.endpointDirection(true),
                            command.endpointTopologyKindName(true),
                            command.endpointTopologyId(true)),
                    corridorEndpoint(
                            command.endpointKindName(false),
                            command.endpointHostCorridorId(false),
                            command.endpointRoomId(false),
                            command.endpointClusterId(false),
                            command.endpointCellQ(false),
                            command.endpointCellR(false),
                            command.endpointCellLevel(false),
                            command.endpointDirection(false),
                            command.endpointTopologyKindName(false),
                            command.endpointTopologyId(false)));
            case OPERATION_EXTEND_CORRIDOR -> toExtendCorridorInput(command);
            case OPERATION_MERGE_CORRIDORS -> new ApplyDungeonAuthoredMutationUseCase.MergeCorridorsInput(
                    command.corridorId(),
                    command.mergedCorridorId());
            case OPERATION_DELETE_CORRIDOR -> new ApplyDungeonAuthoredMutationUseCase.DeleteCorridorInput(
                    command.corridorId());
            case OPERATION_SAVE_ROOM_NARRATION -> toSaveRoomNarrationInput(command);
            case OPERATION_NOOP -> ApplyDungeonAuthoredMutationUseCase.NoopInput.INSTANCE;
            default -> throw new IllegalArgumentException("Unsupported authored mutation operation");
        };
    }

    private static ApplyDungeonAuthoredMutationUseCase.MoveTopologyElementInput moveTopologyElementInput(
            String topologyKindName,
            long topologyId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new ApplyDungeonAuthoredMutationUseCase.MoveTopologyElementInput(
                topologyRef(topologyKindName, topologyId),
                deltaQ,
                deltaR,
                deltaLevel);
    }

    private static ApplyDungeonAuthoredMutationUseCase.MoveEditorHandleInput toMoveEditorHandleInput(
            DungeonAuthoredMutationCommand command
    ) {
        return new ApplyDungeonAuthoredMutationUseCase.MoveEditorHandleInput(
                toHandleInput(command),
                command.deltaQ(),
                command.deltaR(),
                command.deltaLevel());
    }

    private static ApplyDungeonAuthoredMutationUseCase.HandleInput toHandleInput(
            DungeonAuthoredMutationCommand command
    ) {
        return new ApplyDungeonAuthoredMutationUseCase.HandleInput(
                command.handleKindName(),
                topologyRef(command.handleTopologyKindName(), command.handleTopologyId()),
                command.handleOwnerId(),
                command.handleClusterId(),
                command.handleCorridorId(),
                command.handleRoomId(),
                command.handleIndex(),
                cell(command.handleCellQ(), command.handleCellR(), command.handleCellLevel()),
                command.handleDirection());
    }

    private static ApplyDungeonAuthoredMutationUseCase.MoveBoundaryStretchInput toMoveBoundaryStretchInput(
            DungeonAuthoredMutationCommand command
    ) {
        return new ApplyDungeonAuthoredMutationUseCase.MoveBoundaryStretchInput(
                command.clusterId(),
                toEdgesInput(command),
                command.deltaQ(),
                command.deltaR(),
                command.deltaLevel());
    }

    private static ApplyDungeonAuthoredMutationUseCase.EditClusterBoundariesInput toEditClusterBoundariesInput(
            DungeonAuthoredMutationCommand command
    ) {
        return new ApplyDungeonAuthoredMutationUseCase.EditClusterBoundariesInput(
                command.clusterId(),
                toEdgesInput(command),
                command.boundaryKindName(),
                command.deleteBoundary());
    }

    private static ApplyDungeonAuthoredMutationUseCase.ExtendCorridorInput toExtendCorridorInput(
            DungeonAuthoredMutationCommand command
    ) {
        return new ApplyDungeonAuthoredMutationUseCase.ExtendCorridorInput(
                command.corridorId(),
                new ApplyDungeonAuthoredMutationUseCase.CorridorRoomEndpointInput(
                        command.roomEndpointRoomId(),
                        command.roomEndpointClusterId(),
                        command.roomEndpointFixedDoor(),
                        cell(
                                command.roomEndpointCellQ(),
                                command.roomEndpointCellR(),
                                command.roomEndpointCellLevel()),
                        command.roomEndpointDirection(),
                        topologyRef(command.roomEndpointTopologyKindName(), command.roomEndpointTopologyId())));
    }

    private static ApplyDungeonAuthoredMutationUseCase.SaveRoomNarrationInput toSaveRoomNarrationInput(
            DungeonAuthoredMutationCommand command
    ) {
        return new ApplyDungeonAuthoredMutationUseCase.SaveRoomNarrationInput(
                command.roomId(),
                command.visualDescription(),
                toRoomExitNarrationInputs(command));
    }

    private static List<ApplyDungeonAuthoredMutationUseCase.EdgeInput> toEdgesInput(
            DungeonAuthoredMutationCommand command
    ) {
        List<ApplyDungeonAuthoredMutationUseCase.EdgeInput> edges = new ArrayList<>();
        for (int index = 0; index < command.edgeCount(); index++) {
            edges.add(new ApplyDungeonAuthoredMutationUseCase.EdgeInput(
                    cell(command.edgeFromQ(index), command.edgeFromR(index), command.edgeFromLevel(index)),
                    cell(command.edgeToQ(index), command.edgeToR(index), command.edgeToLevel(index))));
        }
        return List.copyOf(edges);
    }

    private static List<ApplyDungeonAuthoredMutationUseCase.RoomExitNarrationInput> toRoomExitNarrationInputs(
            DungeonAuthoredMutationCommand command
    ) {
        List<ApplyDungeonAuthoredMutationUseCase.RoomExitNarrationInput> exits = new ArrayList<>();
        for (int index = 0; index < command.exitCount(); index++) {
            exits.add(new ApplyDungeonAuthoredMutationUseCase.RoomExitNarrationInput(
                    cell(command.exitCellQ(index), command.exitCellR(index), command.exitCellLevel(index)),
                    command.exitDirection(index),
                    command.exitDescription(index)));
        }
        return List.copyOf(exits);
    }

    @SuppressWarnings({"PMD.ExcessiveParameterList", "PMD.LawOfDemeter"})
    private static ApplyDungeonAuthoredMutationUseCase.CorridorEndpointInput corridorEndpoint(
            String kindName,
            long hostCorridorId,
            long roomId,
            long clusterId,
            int cellQ,
            int cellR,
            int cellLevel,
            String direction,
            String topologyKindName,
            long topologyId
    ) {
        boolean anchorEndpoint = ANCHOR_ENDPOINT.equals(kindName);
        return new ApplyDungeonAuthoredMutationUseCase.CorridorEndpointInput(
                anchorEndpoint
                        ? ApplyDungeonAuthoredMutationUseCase.CorridorEndpointKindInput.ANCHOR
                        : ApplyDungeonAuthoredMutationUseCase.CorridorEndpointKindInput.DOOR,
                anchorEndpoint ? hostCorridorId : 0L,
                anchorEndpoint ? 0L : roomId,
                anchorEndpoint ? 0L : clusterId,
                false,
                cell(cellQ, cellR, cellLevel),
                anchorEndpoint ? DEFAULT_DIRECTION : direction,
                topologyRef(topologyKindName, topologyId));
    }

    private static RefreshDungeonAuthoredUseCase.TopologyRefInput topologyRef(String kindName, long id) {
        return new RefreshDungeonAuthoredUseCase.TopologyRefInput(kindName, id);
    }

    private static ApplyDungeonAuthoredMutationUseCase.CellInput cell(int q, int r, int level) {
        return new ApplyDungeonAuthoredMutationUseCase.CellInput(q, r, level);
    }
}
