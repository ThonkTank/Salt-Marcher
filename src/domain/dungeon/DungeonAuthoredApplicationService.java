package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.map.usecase.RefreshDungeonAuthoredUseCase;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonRoomExitDescription;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
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
@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.TooManyMethods"})
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
        ApplyDungeonEditorOperationUseCase.Mutation mutation = operationMutation(operation.operation());
        if (operation.action().isPreview()) {
            applyDungeonAuthoredMutationUseCase.preview(mapId, mutation);
            return;
        }
        applyDungeonAuthoredMutationUseCase.apply(mapId, mutation);
    }

    private static ApplyDungeonEditorOperationUseCase.Mutation operationMutation(DungeonEditorOperation operation) {
        return switch (operation) {
            case null -> current -> current;
            case DungeonEditorOperation.MoveTopologyElement move -> current -> current.moveTopologyElement(
                    domainTopologyRef(move.ref()),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case DungeonEditorOperation.MoveEditorHandle move -> current -> current.moveEditorHandle(
                    domainHandle(move.ref()),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case DungeonEditorOperation.MoveBoundaryStretch move -> current -> current.moveBoundaryStretch(
                    move.clusterId(),
                    move.sourceEdges().stream().map(DungeonAuthoredApplicationService::domainEdge).toList(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case DungeonEditorOperation.MoveRoomAnchor move ->
                    current -> current.moveRoomAnchor(move.deltaQ(), move.deltaR());
            case DungeonEditorOperation.RoomRectangle rectangle -> rectangle.action().deletesRoomCells()
                    ? current -> current.deleteRoomRectangle(
                    domainCell(rectangle.start()),
                    domainCell(rectangle.end()))
                    : current -> current.paintRoomRectangle(
                    domainCell(rectangle.start()),
                    domainCell(rectangle.end()));
            case DungeonEditorOperation.EditClusterBoundaries edit -> current -> current.editClusterBoundaries(
                    edit.clusterId(),
                    edit.edges().stream().map(DungeonAuthoredApplicationService::domainEdge).toList(),
                    domainBoundaryKind(edit.kind()),
                    edit.deleteBoundary());
            case DungeonEditorOperation.CreateCorridor create -> current -> current.createCorridor(
                    corridorEndpoint(create.start()),
                    corridorEndpoint(create.end()));
            case DungeonEditorOperation.ExtendCorridor extend -> current -> current.extendCorridor(
                    extend.corridorId(),
                    corridorRoomEndpoint(extend.endpoint()));
            case DungeonEditorOperation.MergeCorridors merge ->
                    current -> current.mergeCorridors(merge.corridorId(), merge.mergedCorridorId());
            case DungeonEditorOperation.DeleteCorridor delete ->
                    current -> current.deleteCorridor(delete.corridorId());
            case DungeonEditorOperation.SaveRoomNarration save -> current -> current.saveRoomNarration(
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

    private static DungeonClusterBoundaryKind domainBoundaryKind(DungeonBoundaryKind kind) {
        return kind == DungeonBoundaryKind.DOOR ? DungeonClusterBoundaryKind.DOOR : DungeonClusterBoundaryKind.WALL;
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

    private static DungeonCorridorRoomEndpoint corridorRoomEndpoint(DungeonEditorOperation.CorridorRoomEndpoint endpoint) {
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
                DungeonTopologyElementKind.valueOf(ref.kind().name()),
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
