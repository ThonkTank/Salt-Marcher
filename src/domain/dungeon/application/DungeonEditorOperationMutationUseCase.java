package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapCorridorOps;
import src.domain.dungeon.model.map.model.DungeonMapTopologyOps;
import src.domain.dungeon.model.map.model.DungeonRoomExitDescription;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementRef;

final class DungeonEditorOperationMutationUseCase {

    private DungeonEditorOperationMutationUseCase() {
    }

    static DungeonMap apply(DungeonMap current, @Nullable DungeonEditorOperation operation) {
        if (operation == null) {
            return current;
        }
        DungeonMap topologyMutation = DungeonEditorOperationTopologyMutations.apply(current, operation);
        if (topologyMutation != null) {
            return topologyMutation;
        }
        DungeonMap corridorMutation = DungeonEditorOperationCorridorMutations.apply(current, operation);
        if (corridorMutation != null) {
            return corridorMutation;
        }
        return DungeonEditorOperationNarrationMutations.apply(current, operation);
    }
}

final class DungeonEditorOperationTopologyMutations {

    private DungeonEditorOperationTopologyMutations() {
    }

    static @Nullable DungeonMap apply(DungeonMap current, DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.MoveTopologyElement move) {
            return DungeonMapTopologyOps.moveTopologyElement(
                    current,
                    DungeonEditorOperationRefs.topologyRef(move.ref()),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
        }
        if (operation instanceof DungeonEditorOperation.MoveEditorHandle move) {
            return DungeonMapTopologyOps.moveEditorHandle(
                    current,
                    DungeonEditorOperationHandles.handle(move.ref()),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
        }
        if (operation instanceof DungeonEditorOperation.MoveBoundaryStretch move) {
            return DungeonMapTopologyOps.moveBoundaryStretch(
                    current,
                    move.clusterId(),
                    move.sourceEdges().stream().map(DungeonEditorOperationRefs::edge).toList(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
        }
        if (operation instanceof DungeonEditorOperation.MoveRoomAnchor move) {
            return DungeonMapTopologyOps.moveRoomAnchor(current, move.deltaQ(), move.deltaR());
        }
        if (operation instanceof DungeonEditorOperation.RoomRectangle rectangle) {
            return rectangle.action().deletesRoomCells()
                    ? DungeonMapTopologyOps.deleteRoomRectangle(
                    current,
                    DungeonEditorOperationRefs.cell(rectangle.start()),
                    DungeonEditorOperationRefs.cell(rectangle.end()))
                    : DungeonMapTopologyOps.paintRoomRectangle(
                    current,
                    DungeonEditorOperationRefs.cell(rectangle.start()),
                    DungeonEditorOperationRefs.cell(rectangle.end()));
        }
        if (operation instanceof DungeonEditorOperation.EditClusterBoundaries edit) {
            return DungeonMapTopologyOps.editClusterBoundaries(
                    current,
                    edit.clusterId(),
                    edit.edges().stream().map(DungeonEditorOperationRefs::edge).toList(),
                    DungeonEditorOperationBoundaryKinds.kind(edit.kind()),
                    edit.deleteBoundary());
        }
        return null;
    }
}

final class DungeonEditorOperationCorridorMutations {

    private DungeonEditorOperationCorridorMutations() {
    }

    static @Nullable DungeonMap apply(DungeonMap current, DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.CreateCorridor create) {
            return DungeonMapCorridorOps.createCorridor(
                    current,
                    DungeonEditorOperationCorridors.endpoint(create.start()),
                    DungeonEditorOperationCorridors.endpoint(create.end()));
        }
        if (operation instanceof DungeonEditorOperation.ExtendCorridor extend) {
            return DungeonMapCorridorOps.extendCorridor(
                    current,
                    extend.corridorId(),
                    DungeonEditorOperationCorridors.roomEndpoint(extend.endpoint()));
        }
        if (operation instanceof DungeonEditorOperation.MergeCorridors merge) {
            return DungeonMapCorridorOps.mergeCorridors(current, merge.corridorId(), merge.mergedCorridorId());
        }
        if (operation instanceof DungeonEditorOperation.DeleteCorridor delete) {
            return DungeonMapCorridorOps.deleteCorridor(current, delete.corridorId());
        }
        return null;
    }
}

final class DungeonEditorOperationNarrationMutations {

    private DungeonEditorOperationNarrationMutations() {
    }

    static DungeonMap apply(DungeonMap current, DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.SaveRoomNarration save) {
            return DungeonMapTopologyOps.saveRoomNarration(
                    current,
                    save.roomId(),
                    DungeonEditorOperationNarrations.narration(save));
        }
        return current;
    }
}

final class DungeonEditorOperationRefs {

    private DungeonEditorOperationRefs() {
    }

    static DungeonTopologyRef topologyRef(@Nullable DungeonTopologyElementRef ref) {
        if (ref == null) {
            return DungeonTopologyRef.empty();
        }
        return new DungeonTopologyRef(DungeonTopologyElementKind.valueOf(ref.kind().name()), ref.id());
    }

    static DungeonCell cell(@Nullable DungeonCellRef cell) {
        return cell == null ? originCell() : new DungeonCell(cell.q(), cell.r(), cell.level());
    }

    static DungeonCell originCell() {
        return new DungeonCell(0, 0, 0);
    }

    static DungeonEdge edge(@Nullable DungeonEdgeRef edge) {
        if (edge == null) {
            DungeonCell origin = originCell();
            return new DungeonEdge(origin, origin);
        }
        return new DungeonEdge(cell(edge.from()), cell(edge.to()));
    }
}

final class DungeonEditorOperationBoundaryKinds {

    private DungeonEditorOperationBoundaryKinds() {
    }

    static DungeonClusterBoundaryKind kind(DungeonBoundaryKind kind) {
        return kind != null && kind.isDoor() ? DungeonClusterBoundaryKind.DOOR : DungeonClusterBoundaryKind.WALL;
    }
}

final class DungeonEditorOperationHandles {

    private DungeonEditorOperationHandles() {
    }

    static DungeonEditorHandle handle(@Nullable DungeonEditorHandleRef ref) {
        if (ref == null) {
            return new DungeonEditorHandle(
                    DungeonEditorHandleType.CLUSTER_LABEL,
                    DungeonTopologyRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    DungeonEditorOperationRefs.originCell(),
                    DungeonEdgeDirection.NORTH);
        }
        return new DungeonEditorHandle(
                DungeonEditorHandleType.valueOf(ref.kind().name()),
                DungeonEditorOperationRefs.topologyRef(ref.topologyRef()),
                ref.ownerId(),
                ref.clusterId(),
                ref.corridorId(),
                ref.roomId(),
                ref.index(),
                DungeonEditorOperationRefs.cell(ref.cell()),
                DungeonEditorOperationDirections.direction(ref.direction()));
    }
}

final class DungeonEditorOperationCorridors {

    private DungeonEditorOperationCorridors() {
    }

    static DungeonCorridorEndpoint endpoint(DungeonEditorOperation.CorridorEndpoint endpoint) {
        return switch (endpoint) {
            case DungeonEditorOperation.CorridorDoorEndpoint door -> DungeonCorridorEndpoint.door(
                    door.roomId(),
                    door.clusterId(),
                    DungeonEditorOperationRefs.cell(door.roomCell()),
                    DungeonEditorOperationDirections.direction(door.direction()),
                    DungeonEditorOperationRefs.topologyRef(door.topologyRef()));
            case DungeonEditorOperation.CorridorAnchorEndpoint anchor -> DungeonCorridorEndpoint.anchor(
                    anchor.hostCorridorId(),
                    DungeonEditorOperationRefs.cell(anchor.anchorCell()),
                    DungeonEditorOperationRefs.topologyRef(anchor.topologyRef()));
            case null -> DungeonCorridorEndpoint.door(
                    0L,
                    0L,
                    DungeonEditorOperationRefs.originCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    static DungeonCorridorRoomEndpoint roomEndpoint(DungeonEditorOperation.CorridorRoomEndpoint endpoint) {
        if (endpoint == null) {
            return new DungeonCorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    DungeonEditorOperationRefs.originCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }
        return new DungeonCorridorRoomEndpoint(
                endpoint.roomId(),
                endpoint.clusterId(),
                endpoint.fixedDoor(),
                DungeonEditorOperationRefs.cell(endpoint.roomCell()),
                DungeonEditorOperationDirections.direction(endpoint.direction()),
                DungeonEditorOperationRefs.topologyRef(endpoint.topologyRef()));
    }
}

final class DungeonEditorOperationNarrations {

    private DungeonEditorOperationNarrations() {
    }

    static DungeonRoomNarration narration(DungeonEditorOperation.SaveRoomNarration saveRoomNarration) {
        return new DungeonRoomNarration(
                saveRoomNarration.visualDescription(),
                saveRoomNarration.exits().stream().map(DungeonEditorOperationNarrations::exit).toList());
    }

    private static DungeonRoomExitDescription exit(DungeonInspectorSnapshot.RoomExitNarration exitNarration) {
        return new DungeonRoomExitDescription(
                DungeonEditorOperationRefs.cell(exitNarration.cell()),
                DungeonEdgeDirection.parse(exitNarration.direction()),
                exitNarration.description());
    }
}

final class DungeonEditorOperationDirections {

    private DungeonEditorOperationDirections() {
    }

    static DungeonEdgeDirection direction(String direction) {
        return direction == null || direction.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(direction);
    }
}
