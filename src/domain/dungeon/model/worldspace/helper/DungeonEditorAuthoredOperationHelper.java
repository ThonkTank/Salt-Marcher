package src.domain.dungeon.model.worldspace.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.worldspace.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.worldspace.model.DungeonEdge;
import src.domain.dungeon.model.worldspace.model.DungeonEdgeDirection;
import src.domain.dungeon.model.worldspace.model.DungeonEditorAuthoredOperation;
import src.domain.dungeon.model.worldspace.model.DungeonEditorHandle;
import src.domain.dungeon.model.worldspace.model.DungeonRoomExitDescription;
import src.domain.dungeon.model.worldspace.model.DungeonRoomNarration;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyRef;

public interface DungeonEditorAuthoredOperationHelper {

    static DungeonRoomNarration roomNarration(DungeonEditorRoomNarrationInput roomNarration) {
        return new DungeonRoomNarration(
                roomNarration.visualDescription(),
                roomExits(roomNarration.exits()));
    }

    static @Nullable DungeonEditorAuthoredOperation authoredOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        return switch (preview) {
            case null -> null;
            case DungeonEditorSessionValues.NoPreview ignored -> null;
            case DungeonEditorSessionValues.RoomRectanglePreview room -> roomOperation(room);
            case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries ->
                    DungeonEditorAuthoredOperation.editClusterBoundaries(
                            boundaries.clusterId(),
                            edges(boundaries.edges()),
                            boundaryKind(boundaries.boundaryKind()),
                            boundaries.deleteMode());
            case DungeonEditorSessionValues.CorridorCreatePreview corridor ->
                    DungeonEditorAuthoredOperation.createCorridor(
                            corridorEndpoint(corridor.start()),
                            corridorEndpoint(corridor.end()));
            case DungeonEditorSessionValues.DeleteCorridorPreview corridorDelete ->
                    DungeonEditorAuthoredOperation.deleteCorridor(corridorDelete.corridorId());
            case DungeonEditorSessionValues.MoveHandlePreview moveHandle ->
                    DungeonEditorAuthoredOperation.moveEditorHandle(
                            handle(moveHandle.handleRef()),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch ->
                    DungeonEditorAuthoredOperation.moveBoundaryStretch(
                            stretch.clusterId(),
                            edges(stretch.sourceEdges()),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
        };
    }

    static DungeonCell cell(DungeonEditorWorkspaceValues.Cell cell) {
        DungeonEditorWorkspaceValues.Cell safeCell = cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : cell;
        return new DungeonCell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    static List<DungeonEdge> edges(List<DungeonEditorWorkspaceValues.Edge> edges) {
        if (edges == null) {
            return List.of();
        }
        List<DungeonEdge> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Edge edge : edges) {
            if (edge == null) {
                DungeonCell origin = cell(null);
                result.add(new DungeonEdge(origin, origin));
            } else {
                result.add(new DungeonEdge(cell(edge.from()), cell(edge.to())));
            }
        }
        return List.copyOf(result);
    }

    static DungeonClusterBoundaryKind boundaryKind(
            DungeonEditorWorkspaceValues.BoundaryKind boundaryKind
    ) {
        return boundaryKind != null && boundaryKind.isDoor()
                ? DungeonClusterBoundaryKind.DOOR
                : DungeonClusterBoundaryKind.WALL;
    }

    static DungeonEditorHandle handle(DungeonEditorWorkspaceValues.HandleRef ref) {
        DungeonEditorWorkspaceValues.HandleRef safeRef = ref == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : ref;
        return new DungeonEditorHandle(
                safeRef.kind(),
                safeRef.topologyRef(),
                safeRef.ownerId(),
                safeRef.clusterId(),
                safeRef.corridorId(),
                safeRef.roomId(),
                safeRef.index(),
                cell(safeRef.cell()),
                direction(safeRef.direction()));
    }

    static DungeonCorridorEndpoint corridorEndpoint(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door -> DungeonCorridorEndpoint.door(
                    door.roomId(),
                    door.clusterId(),
                    cell(door.roomCell()),
                    direction(door.direction()),
                    door.topologyRef());
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor -> DungeonCorridorEndpoint.anchor(
                    anchor.hostCorridorId(),
                    cell(anchor.anchorCell()),
                    anchor.topologyRef());
            case null -> DungeonCorridorEndpoint.door(
                    0L,
                    0L,
                    cell(null),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    private static DungeonEditorAuthoredOperation roomOperation(
            DungeonEditorSessionValues.RoomRectanglePreview room
    ) {
        return room.deleteMode()
                ? DungeonEditorAuthoredOperation.deleteRoomRectangle(
                        cell(room.start()),
                        cell(room.end()))
                : DungeonEditorAuthoredOperation.paintRoomRectangle(
                        cell(room.start()),
                        cell(room.end()));
    }

    private static List<DungeonRoomExitDescription> roomExits(
            List<DungeonEditorWorkspaceValues.RoomExitNarration> exits
    ) {
        List<DungeonRoomExitDescription> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.RoomExitNarration exit : exits) {
            DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                    ? new DungeonEditorWorkspaceValues.RoomExitNarration(
                            "",
                            DungeonEditorWorkspaceValues.Cell.empty(),
                            "",
                            "")
                    : exit;
            result.add(new DungeonRoomExitDescription(
                    cell(safeExit.cell()),
                    direction(safeExit.direction()),
                    safeExit.description()));
        }
        return List.copyOf(result);
    }

    private static DungeonEdgeDirection direction(String direction) {
        return direction == null || direction.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(direction);
    }
}
