package src.domain.dungeon;

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
@SuppressWarnings({"PMD.TooManyMethods", "PMD.AvoidDuplicateLiterals"})
public final class DungeonAuthoredApplicationService {

    private static final String DEFAULT_DIRECTION = "";

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
                "PREVIEW".equals(command.actionName())
                        ? ApplyDungeonAuthoredMutationUseCase.ActionInput.PREVIEW
                        : ApplyDungeonAuthoredMutationUseCase.ActionInput.APPLY,
                command.mapIdValue(),
                switch (command.operationKindName()) {
            case "MOVE_TOPOLOGY_ELEMENT" -> new ApplyDungeonAuthoredMutationUseCase.MoveTopologyElementInput(
                    topologyRef(command.topologyKindName(), command.topologyId()),
                    command.deltaQ(),
                    command.deltaR(),
                    command.deltaLevel());
            case "MOVE_EDITOR_HANDLE" -> new ApplyDungeonAuthoredMutationUseCase.MoveEditorHandleInput(
                    new ApplyDungeonAuthoredMutationUseCase.HandleInput(
                            command.handleKindName(),
                            topologyRef(command.handleTopologyKindName(), command.handleTopologyId()),
                            command.handleOwnerId(),
                            command.handleClusterId(),
                            command.handleCorridorId(),
                            command.handleRoomId(),
                            command.handleIndex(),
                            cell(command.handleCellQ(), command.handleCellR(), command.handleCellLevel()),
                            command.handleDirection()),
                    command.deltaQ(),
                    command.deltaR(),
                    command.deltaLevel());
            case "MOVE_BOUNDARY_STRETCH" -> {
                List<ApplyDungeonAuthoredMutationUseCase.EdgeInput> edges = new ArrayList<>();
                for (int index = 0; index < command.edgeCount(); index++) {
                    edges.add(edge(
                            command.edgeFromQ(index),
                            command.edgeFromR(index),
                            command.edgeFromLevel(index),
                            command.edgeToQ(index),
                            command.edgeToR(index),
                            command.edgeToLevel(index)));
                }
                yield new ApplyDungeonAuthoredMutationUseCase.MoveBoundaryStretchInput(
                        command.clusterId(),
                        List.copyOf(edges),
                        command.deltaQ(),
                        command.deltaR(),
                        command.deltaLevel());
            }
            case "MOVE_ROOM_ANCHOR" -> new ApplyDungeonAuthoredMutationUseCase.MoveRoomAnchorInput(
                    command.deltaQ(),
                    command.deltaR());
            case "ROOM_RECTANGLE" -> new ApplyDungeonAuthoredMutationUseCase.RoomRectangleInput(
                    command.rectangleActionName(),
                    cell(command.startCellQ(), command.startCellR(), command.startCellLevel()),
                    cell(command.endCellQ(), command.endCellR(), command.endCellLevel()));
            case "EDIT_CLUSTER_BOUNDARIES" -> {
                List<ApplyDungeonAuthoredMutationUseCase.EdgeInput> edges = new ArrayList<>();
                for (int index = 0; index < command.edgeCount(); index++) {
                    edges.add(edge(
                            command.edgeFromQ(index),
                            command.edgeFromR(index),
                            command.edgeFromLevel(index),
                            command.edgeToQ(index),
                            command.edgeToR(index),
                            command.edgeToLevel(index)));
                }
                yield new ApplyDungeonAuthoredMutationUseCase.EditClusterBoundariesInput(
                        command.clusterId(),
                        List.copyOf(edges),
                        command.boundaryKindName(),
                        command.deleteBoundary());
            }
            case "CREATE_CORRIDOR" -> new ApplyDungeonAuthoredMutationUseCase.CreateCorridorInput(
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
            case "EXTEND_CORRIDOR" -> new ApplyDungeonAuthoredMutationUseCase.ExtendCorridorInput(
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
            case "MERGE_CORRIDORS" -> new ApplyDungeonAuthoredMutationUseCase.MergeCorridorsInput(
                    command.corridorId(),
                    command.mergedCorridorId());
            case "DELETE_CORRIDOR" -> new ApplyDungeonAuthoredMutationUseCase.DeleteCorridorInput(
                    command.corridorId());
            case "SAVE_ROOM_NARRATION" -> {
                List<ApplyDungeonAuthoredMutationUseCase.RoomExitNarrationInput> exits = new ArrayList<>();
                for (int index = 0; index < command.exitCount(); index++) {
                    exits.add(new ApplyDungeonAuthoredMutationUseCase.RoomExitNarrationInput(
                            cell(command.exitCellQ(index), command.exitCellR(index), command.exitCellLevel(index)),
                            command.exitDirection(index),
                            command.exitDescription(index)));
                }
                yield new ApplyDungeonAuthoredMutationUseCase.SaveRoomNarrationInput(
                        command.roomId(),
                        command.visualDescription(),
                        List.copyOf(exits));
            }
            case "NOOP" -> ApplyDungeonAuthoredMutationUseCase.NoopInput.INSTANCE;
            default -> throw new IllegalArgumentException("Unsupported authored mutation operation");
        });
    }

    private static ApplyDungeonAuthoredMutationUseCase.CorridorEndpointInput corridorEndpoint(
            String kindName,
            long hostCorridorId,
            long roomId,
            long clusterId,
            int q,
            int r,
            int level,
            String direction,
            String topologyKindName,
            long topologyId
    ) {
        return "ANCHOR".equals(kindName)
                ? new ApplyDungeonAuthoredMutationUseCase.CorridorEndpointInput(
                    ApplyDungeonAuthoredMutationUseCase.CorridorEndpointKindInput.ANCHOR,
                    hostCorridorId,
                    0L,
                    0L,
                    false,
                    cell(q, r, level),
                    DEFAULT_DIRECTION,
                    topologyRef(topologyKindName, topologyId))
                : new ApplyDungeonAuthoredMutationUseCase.CorridorEndpointInput(
                    ApplyDungeonAuthoredMutationUseCase.CorridorEndpointKindInput.DOOR,
                    0L,
                    roomId,
                    clusterId,
                    false,
                    cell(q, r, level),
                    direction,
                    topologyRef(topologyKindName, topologyId));
    }

    private static RefreshDungeonAuthoredUseCase.TopologyRefInput topologyRef(String kindName, long id) {
        return new RefreshDungeonAuthoredUseCase.TopologyRefInput(kindName, id);
    }

    private static ApplyDungeonAuthoredMutationUseCase.CellInput cell(int q, int r, int level) {
        return new ApplyDungeonAuthoredMutationUseCase.CellInput(q, r, level);
    }

    private static ApplyDungeonAuthoredMutationUseCase.EdgeInput edge(int fromQ, int fromR, int fromLevel,
            int toQ, int toR, int toLevel) {
        return new ApplyDungeonAuthoredMutationUseCase.EdgeInput(
                cell(fromQ, fromR, fromLevel),
                cell(toQ, toR, toLevel));
    }
}
