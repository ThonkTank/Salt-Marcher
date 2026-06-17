package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.DungeonRoomExitDescription;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovementKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorAuthoredOperation;

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
            case DungeonEditorSessionValues.StairCreatePreview ignored -> null;
            case DungeonEditorSessionValues.CorridorCreatePreview corridor ->
                    DungeonEditorAuthoredOperation.createCorridor(
                            corridorEndpoint(corridor.start()),
                            corridorEndpoint(corridor.end()));
            case DungeonEditorSessionValues.DeleteCorridorPreview corridorDelete ->
                    DungeonEditorAuthoredOperation.deleteCorridor(
                            corridorDelete.corridorId(),
                            corridorDelete.targetKind(),
                            corridorDelete.topologyRefId(),
                            corridorDelete.roomId(),
                            corridorDelete.waypointIndex());
            case DungeonEditorSessionValues.MoveHandlePreview moveHandle ->
                    DungeonEditorAuthoredOperation.moveEditorHandle(
                            new DungeonEditorHandleMovement(
                                    DungeonEditorHandleMovementKind.fromName(moveHandle.handleRef().kind().name()),
                                    moveHandle.handleRef().topologyRef(),
                                    moveHandle.handleRef().ownerId(),
                                    moveHandle.handleRef().clusterId(),
                                    moveHandle.handleRef().corridorId(),
                                    moveHandle.handleRef().roomId(),
                                    moveHandle.handleRef().index(),
                                    cell(moveHandle.handleRef().cell()),
                                    Direction.parse(moveHandle.handleRef().direction()),
                                    moveHandle.handleRef().sourceEdge() == null
                                            ? null
                                            : edge(moveHandle.handleRef().sourceEdge())),
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

    static Cell cell(DungeonEditorWorkspaceValues.Cell cell) {
        DungeonEditorWorkspaceValues.Cell safeCell = cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : cell;
        return new Cell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    static List<Edge> edges(List<DungeonEditorWorkspaceValues.Edge> edges) {
        if (edges == null) {
            return List.of();
        }
        List<Edge> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Edge edge : edges) {
            if (edge == null) {
                Cell origin = cell(null);
                result.add(new Edge(origin, origin));
            } else {
                result.addAll(unitEdges(cell(edge.from()), cell(edge.to())));
            }
        }
        return List.copyOf(result);
    }

    static Edge edge(DungeonEditorWorkspaceValues.Edge edge) {
        if (edge == null) {
            Cell origin = cell(null);
            return new Edge(origin, origin);
        }
        return new Edge(cell(edge.from()), cell(edge.to()));
    }

    private static List<Edge> unitEdges(Cell from, Cell to) {
        if (from.level() != to.level()) {
            return List.of(new Edge(from, to));
        }
        int deltaQ = Integer.compare(to.q(), from.q());
        int deltaR = Integer.compare(to.r(), from.r());
        if (deltaQ != 0 && deltaR != 0) {
            return List.of(new Edge(from, to));
        }
        List<Edge> result = new ArrayList<>();
        for (int q = from.q(), r = from.r(); q != to.q() || r != to.r(); q += deltaQ, r += deltaR) {
            result.add(new Edge(
                    new Cell(q, r, from.level()),
                    new Cell(q + deltaQ, r + deltaR, from.level())));
        }
        return List.copyOf(result);
    }

    static BoundaryKind boundaryKind(
            DungeonEditorWorkspaceValues.BoundaryKind boundaryKind
    ) {
        return boundaryKind != null && boundaryKind.isDoor()
                ? BoundaryKind.DOOR
                : BoundaryKind.WALL;
    }

    static DungeonCorridorEndpoint corridorEndpoint(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door -> DungeonCorridorEndpoint.door(
                    door.roomId(),
                    door.clusterId(),
                    cell(door.roomCell()),
                    Direction.parse(door.direction()),
                    door.topologyRef());
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor -> DungeonCorridorEndpoint.anchor(
                    anchor.hostCorridorId(),
                    cell(anchor.anchorCell()),
                    anchor.topologyRef());
            case null -> DungeonCorridorEndpoint.door(
                    0L,
                    0L,
                    cell(null),
                    Direction.NORTH,
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
                    Direction.parse(safeExit.direction()),
                    safeExit.description()));
        }
        return List.copyOf(result);
    }
}
