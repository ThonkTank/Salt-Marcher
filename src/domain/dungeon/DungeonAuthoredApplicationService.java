package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.application.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.application.DungeonEditorOperationInstructionUseCase;
import src.domain.dungeon.application.RefreshDungeonAuthoredUseCase;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonRoomExitDescription;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTopologyElementRef;

/**
 * Public authored-dungeon backend boundary for reads and mutations.
 */
public final class DungeonAuthoredApplicationService {

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
        DungeonAuthoredReadCommand safeCommand = Objects.requireNonNull(command, "command");
        if (safeCommand instanceof DungeonAuthoredReadCommand.MapSelection mapSelection) {
            refreshDungeonAuthoredUseCase.refreshMap(domainMapId(mapSelection.mapId()));
            return;
        }
        DungeonAuthoredReadCommand.DescribeSelection describeSelection =
                (DungeonAuthoredReadCommand.DescribeSelection) safeCommand;
        refreshDungeonAuthoredUseCase.describeSelection(
                domainMapId(describeSelection.mapId()),
                domainTopologyRef(describeSelection.topologyRef()),
                describeSelection.clusterId(),
                describeSelection.clusterSelection());
    }

    public void mutateAuthored(DungeonAuthoredMutationCommand command) {
        DungeonAuthoredMutationCommand.Operation operation =
                (DungeonAuthoredMutationCommand.Operation) Objects.requireNonNull(command, "command");
        DungeonMapIdentity mapId = domainMapId(operation.mapId());
        DungeonEditorOperationInstructionUseCase.Instruction instruction = operationInstruction(operation.operation());
        if (operation.action() == DungeonAuthoredMutationCommand.Action.PREVIEW) {
            applyDungeonAuthoredMutationUseCase.preview(mapId, instruction);
            return;
        }
        applyDungeonAuthoredMutationUseCase.apply(mapId, instruction);
    }

    private static DungeonEditorOperationInstructionUseCase.Instruction operationInstruction(
            DungeonEditorOperation operation
    ) {
        return switch (operation) {
            case null -> new DungeonEditorOperationInstructionUseCase.Identity();
            case DungeonEditorOperation.MoveTopologyElement move -> new DungeonEditorOperationInstructionUseCase.MoveTopologyElement(
                    domainTopologyRef(move.ref()),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case DungeonEditorOperation.MoveEditorHandle move -> new DungeonEditorOperationInstructionUseCase.MoveEditorHandle(
                    domainHandle(move.ref()),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case DungeonEditorOperation.MoveBoundaryStretch move -> new DungeonEditorOperationInstructionUseCase.MoveBoundaryStretch(
                    move.clusterId(),
                    move.sourceEdges().stream().map(DungeonAuthoredApplicationService::domainEdge).toList(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case DungeonEditorOperation.MoveRoomAnchor move ->
                    new DungeonEditorOperationInstructionUseCase.MoveRoomAnchor(move.deltaQ(), move.deltaR());
            case DungeonEditorOperation.RoomRectangle rectangle -> new DungeonEditorOperationInstructionUseCase.RoomRectangle(
                    domainCell(rectangle.start()),
                    domainCell(rectangle.end()),
                    rectangle.action().deletesRoomCells());
            case DungeonEditorOperation.EditClusterBoundaries edit -> new DungeonEditorOperationInstructionUseCase.EditClusterBoundaries(
                    edit.clusterId(),
                    edit.edges().stream().map(DungeonAuthoredApplicationService::domainEdge).toList(),
                    edit.kind() == DungeonBoundaryKind.DOOR ? DungeonClusterBoundaryKind.DOOR : DungeonClusterBoundaryKind.WALL,
                    edit.deleteBoundary());
            case DungeonEditorOperation.CreateCorridor create -> new DungeonEditorOperationInstructionUseCase.CreateCorridor(
                    corridorEndpoint(create.start()),
                    corridorEndpoint(create.end()));
            case DungeonEditorOperation.ExtendCorridor extend -> new DungeonEditorOperationInstructionUseCase.ExtendCorridor(
                    extend.corridorId(),
                    corridorRoomEndpoint(extend.endpoint()));
            case DungeonEditorOperation.MergeCorridors merge -> new DungeonEditorOperationInstructionUseCase.MergeCorridors(
                    merge.corridorId(),
                    merge.mergedCorridorId());
            case DungeonEditorOperation.DeleteCorridor delete ->
                    new DungeonEditorOperationInstructionUseCase.DeleteCorridor(delete.corridorId());
            case DungeonEditorOperation.SaveRoomNarration save -> new DungeonEditorOperationInstructionUseCase.SaveRoomNarration(
                    save.roomId(),
                    roomNarration(save));
        };
    }

    private static DungeonEditorHandle domainHandle(DungeonEditorHandleRef ref) {
        if (ref == null) {
            return new DungeonEditorHandle(
                    DungeonEditorHandleType.CLUSTER_LABEL,
                    DungeonTopologyRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    domainCell(null),
                    DungeonEdgeDirection.NORTH);
        }
        return new DungeonEditorHandle(
                DungeonEditorHandleType.valueOf(ref.kind().name()),
                domainTopologyRef(ref.topologyRef()),
                ref.ownerId(),
                ref.clusterId(),
                ref.corridorId(),
                ref.roomId(),
                ref.index(),
                domainCell(ref.cell()),
                direction(ref.direction()));
    }

    private static DungeonCorridorEndpoint corridorEndpoint(DungeonEditorOperation.CorridorEndpoint endpoint) {
        return switch (endpoint) {
            case DungeonEditorOperation.CorridorDoorEndpoint door -> DungeonCorridorEndpoint.door(
                    door.roomId(),
                    door.clusterId(),
                    domainCell(door.roomCell()),
                    direction(door.direction()),
                    domainTopologyRef(door.topologyRef()));
            case DungeonEditorOperation.CorridorAnchorEndpoint anchor -> DungeonCorridorEndpoint.anchor(
                    anchor.hostCorridorId(),
                    domainCell(anchor.anchorCell()),
                    domainTopologyRef(anchor.topologyRef()));
            case null -> DungeonCorridorEndpoint.door(
                    0L,
                    0L,
                    domainCell(null),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    private static DungeonCorridorRoomEndpoint corridorRoomEndpoint(
            DungeonEditorOperation.CorridorRoomEndpoint endpoint
    ) {
        if (endpoint == null) {
            return new DungeonCorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    domainCell(null),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }
        return new DungeonCorridorRoomEndpoint(
                endpoint.roomId(),
                endpoint.clusterId(),
                endpoint.fixedDoor(),
                domainCell(endpoint.roomCell()),
                direction(endpoint.direction()),
                domainTopologyRef(endpoint.topologyRef()));
    }

    private static DungeonRoomNarration roomNarration(DungeonEditorOperation.SaveRoomNarration saveRoomNarration) {
        return new DungeonRoomNarration(
                saveRoomNarration.visualDescription(),
                saveRoomNarration.exits().stream().map(DungeonAuthoredApplicationService::exitNarration).toList());
    }

    private static DungeonRoomExitDescription exitNarration(DungeonInspectorSnapshot.RoomExitNarration exitNarration) {
        return new DungeonRoomExitDescription(
                domainCell(exitNarration.cell()),
                DungeonEdgeDirection.parse(exitNarration.direction()),
                exitNarration.description());
    }

    private static DungeonTopologyRef domainTopologyRef(DungeonTopologyElementRef ref) {
        if (ref == null) {
            return DungeonTopologyRef.empty();
        }
        return new DungeonTopologyRef(
                src.domain.dungeon.model.map.model.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    private static DungeonCell domainCell(DungeonCellRef cell) {
        return cell == null ? new DungeonCell(0, 0, 0) : new DungeonCell(cell.q(), cell.r(), cell.level());
    }

    private static DungeonEdge domainEdge(DungeonEdgeRef edge) {
        if (edge == null) {
            DungeonCell origin = domainCell(null);
            return new DungeonEdge(origin, origin);
        }
        return new DungeonEdge(domainCell(edge.from()), domainCell(edge.to()));
    }

    private static DungeonMapIdentity domainMapId(DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static DungeonEdgeDirection direction(String direction) {
        return direction == null || direction.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(direction);
    }
}
