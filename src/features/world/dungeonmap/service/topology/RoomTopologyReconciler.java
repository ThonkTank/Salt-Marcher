package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class RoomTopologyReconciler {

    private RoomTopologyReconciler() {
    }

    static TopologyIntent reconcile(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        TopologyIntent effectiveIntent = PaintedSquareRoomAssigner.assignPaintedSquaresToRooms(conn, mapId, intent, workspace);
        workspace.reload(conn);
        effectiveIntent = derivePrimaryRoomPriority(workspace, effectiveIntent);
        if (effectiveIntent.squareEdits().isEmpty()) {
            reconcileRoomComponents(conn, mapId, effectiveIntent, workspace);
            workspace.reload(conn);
        }
        return effectiveIntent;
    }

    static void reconcileRoomComponentsAfterBoundaryWalls(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        reconcileRoomComponents(conn, mapId, intent, workspace);
        workspace.reload(conn);
    }

    private static TopologyIntent derivePrimaryRoomPriority(TopologyWorkspace workspace, TopologyIntent intent) {
        if (!intent.primaryRoomPriority().isEmpty() || intent.editedCells().isEmpty()) {
            return intent;
        }
        LinkedHashSet<Long> roomIds = new LinkedHashSet<>();
        for (EditedCell editedCell : intent.editedCells()) {
            DungeonSquare square = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(editedCell.x(), editedCell.y()));
            if (square != null && square.roomId() != null) {
                roomIds.add(square.roomId());
            }
        }
        return roomIds.isEmpty() ? intent : intent.withPrimaryRoomPriority(List.copyOf(roomIds));
    }

    private static void reconcileRoomComponents(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        List<DungeonSquare> squares = workspace.currentSquares();
        List<DungeonRoom> rooms = workspace.rooms();
        if (squares.isEmpty()) {
            deleteAllRooms(conn, rooms);
            return;
        }

        List<RoomComponentGraph.RoomComponent> components = RoomComponentGraph.buildRoomComponents(squares, workspace.wallsByEdge());
        Map<Long, Integer> largestComponentByRoomId = RoomComponentGraph.findLargestComponentByRoom(components, intent);
        int nextDefaultRoomNumber = PaintedSquareRoomAssigner.nextDefaultRoomNumber(rooms);
        Set<Long> retainedRoomIds = new java.util.HashSet<>();

        for (RoomComponentGraph.RoomComponent component : components) {
            ComponentAssignment assignment =
                    assignComponentRoom(conn, mapId, component, workspace.roomsById(), largestComponentByRoomId, intent, nextDefaultRoomNumber);
            retainedRoomIds.add(assignment.targetRoomId());
            if (assignment.createdNewRoom()) {
                nextDefaultRoomNumber++;
            }
            assignComponentSquares(conn, component.squares(), assignment.targetRoomId());
        }

        deleteUnretainedRooms(conn, rooms, retainedRoomIds);
    }

    private static ComponentAssignment assignComponentRoom(
            Connection conn,
            long mapId,
            RoomComponentGraph.RoomComponent component,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, Integer> largestComponentByRoomId,
            TopologyIntent intent,
            int nextDefaultRoomNumber
    ) throws SQLException {
        List<Long> retainableRoomIds = RoomComponentGraph.retainableRoomIds(component, largestComponentByRoomId);
        Long primaryRoomId = PreferredRoomSelector.selectPreferredRoomId(retainableRoomIds, component.roomSquareCounts(), intent);
        if (primaryRoomId != null) {
            updatePrimaryRoom(conn, component, primaryRoomId, largestComponentByRoomId, roomsById, intent);
            return new ComponentAssignment(primaryRoomId, false);
        }

        DungeonRoom templateRoom = selectTemplateRoom(component, roomsById, intent);
        DungeonRoom newRoom = new DungeonRoom(
                null,
                mapId,
                "Raum #" + nextDefaultRoomNumber,
                templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.description()),
                templateRoom == null ? null : templateRoom.areaId());
        return new ComponentAssignment(DungeonRoomRepository.upsertRoom(conn, newRoom), true);
    }

    private static void updatePrimaryRoom(
            Connection conn,
            RoomComponentGraph.RoomComponent component,
            long primaryRoomId,
            Map<Long, Integer> largestComponentByRoomId,
            Map<Long, DungeonRoom> roomsById,
            TopologyIntent intent
    ) throws SQLException {
        List<Long> mergedRoomIds = new ArrayList<>();
        for (Long roomId : component.roomIds()) {
            if (roomId == null || roomId == primaryRoomId) {
                continue;
            }
            if (largestComponentByRoomId.getOrDefault(roomId, -1) == component.index()) {
                mergedRoomIds.add(roomId);
            }
        }
        mergedRoomIds.sort(RoomMetadataMerger.roomMergeComparator(component.roomSquareCounts(), intent));
        RoomMetadataMerger.updateMergedRoomMetadata(
                conn,
                primaryRoomId,
                mergedRoomIds,
                roomsById,
                component.roomSquareCounts(),
                intent);
    }

    private static DungeonRoom selectTemplateRoom(
            RoomComponentGraph.RoomComponent component,
            Map<Long, DungeonRoom> roomsById,
            TopologyIntent intent
    ) {
        Long templateRoomId = PreferredRoomSelector.selectPreferredRoomId(
                List.copyOf(component.roomIds()),
                component.roomSquareCounts(),
                intent);
        return templateRoomId == null ? null : roomsById.get(templateRoomId);
    }

    private static void assignComponentSquares(Connection conn, List<DungeonSquare> squares, long targetRoomId) throws SQLException {
        for (DungeonSquare square : squares) {
            if (square.roomId() == null || square.roomId() != targetRoomId) {
                DungeonSquareRepository.assignSquareRoom(conn, square.squareId(), targetRoomId);
            }
        }
    }

    private static void deleteUnretainedRooms(Connection conn, List<DungeonRoom> rooms, Set<Long> retainedRoomIds) throws SQLException {
        for (DungeonRoom room : rooms) {
            if (!retainedRoomIds.contains(room.roomId())) {
                DungeonRoomRepository.deleteRoom(conn, room.roomId());
            }
        }
    }

    private static void deleteAllRooms(Connection conn, List<DungeonRoom> rooms) throws SQLException {
        for (DungeonRoom room : rooms) {
            DungeonRoomRepository.deleteRoom(conn, room.roomId());
        }
    }

    private record ComponentAssignment(
            long targetRoomId,
            boolean createdNewRoom
    ) {
    }
}
