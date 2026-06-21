package src.domain.dungeon.model.runtime.helper;

import java.util.List;
import java.util.ArrayList;
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
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
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
            case DungeonEditorSessionValues.RoomRectanglePreview ignored -> null;
            case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries ->
                    boundaries.boundaryKind().isDoor()
                            ? DungeonEditorAuthoredOperation.editClusterBoundaries(
                                    boundaries.clusterId(),
                                    edges(boundaries.edges()),
                                    boundaryKind(boundaries.boundaryKind()),
                                    boundaries.deleteMode())
                            : null;
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
        return DungeonEditorWorkspaceCoreGeometry.cell(safeCell);
    }

    static List<Edge> edges(List<DungeonEditorWorkspaceValues.Edge> edges) {
        if (edges == null) {
            return List.of();
        }
        List<DungeonEditorWorkspaceValues.Edge> safeEdges = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Edge edge : edges) {
            safeEdges.add(edge == null ? new DungeonEditorWorkspaceValues.Edge(null, null) : edge);
        }
        return DungeonEditorWorkspaceCoreGeometry.edges(safeEdges);
    }

    static Edge edge(DungeonEditorWorkspaceValues.Edge edge) {
        if (edge == null) {
            Cell origin = cell(null);
            return new Edge(origin, origin);
        }
        return DungeonEditorWorkspaceCoreGeometry.edge(edge);
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
