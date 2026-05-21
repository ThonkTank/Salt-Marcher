package src.domain.dungeon.model.editor.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonEditorAuthoredOperation;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonRoomExitDescription;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class DungeonEditorAuthoredOperationHelper {

    private DungeonEditorAuthoredOperationHelper() {
    }

    public static DungeonRoomNarration roomNarration(DungeonEditorRoomNarrationInput roomNarration) {
        return new DungeonRoomNarration(
                roomNarration.visualDescription(),
                roomExits(roomNarration.exits()));
    }

    public static @Nullable DungeonEditorAuthoredOperation authoredOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return null;
        }
        if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room) {
            return room.deleteMode()
                    ? DungeonEditorAuthoredOperation.deleteRoomRectangle(
                            cell(room.start()),
                            cell(room.end()))
                    : DungeonEditorAuthoredOperation.paintRoomRectangle(
                            cell(room.start()),
                            cell(room.end()));
        }
        if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries) {
            return DungeonEditorAuthoredOperation.editClusterBoundaries(
                    boundaries.clusterId(),
                    edges(boundaries.edges()),
                    boundaryKind(boundaries.boundaryKind()),
                    boundaries.deleteMode());
        }
        if (preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor) {
            return DungeonEditorAuthoredOperation.createCorridor(
                    corridorEndpoint(corridor.start()),
                    corridorEndpoint(corridor.end()));
        }
        if (preview instanceof DungeonEditorSessionValues.DeleteCorridorPreview corridorDelete) {
            return DungeonEditorAuthoredOperation.deleteCorridor(corridorDelete.corridorId());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview moveHandle) {
            return DungeonEditorAuthoredOperation.moveEditorHandle(
                    handle(moveHandle.handleRef()),
                    moveHandle.deltaQ(),
                    moveHandle.deltaR(),
                    moveHandle.deltaLevel());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch) {
            return DungeonEditorAuthoredOperation.moveBoundaryStretch(
                    stretch.clusterId(),
                    edges(stretch.sourceEdges()),
                    stretch.deltaQ(),
                    stretch.deltaR(),
                    stretch.deltaLevel());
        }
        return null;
    }

    public static DungeonCell cell(DungeonEditorWorkspaceValues.Cell cell) {
        DungeonEditorWorkspaceValues.Cell safeCell = cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : cell;
        return new DungeonCell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static DungeonEdge edge(DungeonEditorWorkspaceValues.Edge edge) {
        if (edge == null) {
            DungeonCell origin = cell(null);
            return new DungeonEdge(origin, origin);
        }
        return new DungeonEdge(cell(edge.from()), cell(edge.to()));
    }

    public static List<DungeonEdge> edges(List<DungeonEditorWorkspaceValues.Edge> edges) {
        if (edges == null) {
            return List.of();
        }
        List<DungeonEdge> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Edge edge : edges) {
            result.add(edge(edge));
        }
        return List.copyOf(result);
    }

    public static DungeonClusterBoundaryKind boundaryKind(
            DungeonEditorWorkspaceValues.BoundaryKind boundaryKind
    ) {
        return boundaryKind != null && boundaryKind.isDoor()
                ? DungeonClusterBoundaryKind.DOOR
                : DungeonClusterBoundaryKind.WALL;
    }

    public static DungeonEditorHandle handle(DungeonEditorWorkspaceValues.HandleRef ref) {
        DungeonEditorWorkspaceValues.HandleRef safeRef = ref == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : ref;
        return new DungeonEditorHandle(
                safeRef.kind() == null ? DungeonEditorHandleType.CLUSTER_LABEL : safeRef.kind(),
                safeRef.topologyRef(),
                safeRef.ownerId(),
                safeRef.clusterId(),
                safeRef.corridorId(),
                safeRef.roomId(),
                safeRef.index(),
                cell(safeRef.cell()),
                direction(safeRef.direction()));
    }

    public static DungeonCorridorEndpoint corridorEndpoint(
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

    private static List<DungeonRoomExitDescription> roomExits(
            List<DungeonEditorWorkspaceValues.RoomExitNarration> exits
    ) {
        List<DungeonRoomExitDescription> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.RoomExitNarration exit : exits) {
            result.add(roomExit(exit));
        }
        return List.copyOf(result);
    }

    private static DungeonRoomExitDescription roomExit(DungeonEditorWorkspaceValues.RoomExitNarration exit) {
        DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorWorkspaceValues.RoomExitNarration(
                        "",
                        DungeonEditorWorkspaceValues.Cell.empty(),
                        "",
                        "")
                : exit;
        return new DungeonRoomExitDescription(
                cell(safeExit.cell()),
                direction(safeExit.direction()),
                safeExit.description());
    }

    private static DungeonEdgeDirection direction(String direction) {
        return direction == null || direction.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(direction);
    }
}
