package features.world.dungeonmap.rooms.application;
import features.world.dungeonmap.corridors.application.DungeonCorridorRoomReconciler;

import features.world.dungeonmap.rooms.model.DungeonClusterGeometry;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.rooms.model.DungeonRoomNaming;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.rooms.model.RoomShape;
import features.world.dungeonmap.rooms.persistence.DungeonRoomPersistenceRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonClusterRoomReconciler {

    private final DungeonCorridorRoomReconciler corridorRoomReconciler;

    DungeonClusterRoomReconciler(DungeonCorridorRoomReconciler corridorRoomReconciler) {
        this.corridorRoomReconciler = Objects.requireNonNull(corridorRoomReconciler, "corridorRoomReconciler");
    }

    List<DungeonRoom> reconcileClusterRooms(
            Connection conn,
            long mapId,
            long clusterId,
            Point2i clusterCenter,
            List<DungeonRoom> existingRooms,
            Set<Point2i> clusterCells,
            List<DungeonRoomCluster.EdgeOverride> edgeOverrides
    ) throws SQLException {
        List<RoomShape> components = DungeonClusterGeometry.clusterComponentShapes(clusterCenter, clusterCells, edgeOverrides);
        List<DungeonRoom> sortedExistingRooms = existingRooms.stream()
                .filter(room -> room.roomId() != null)
                .sorted(Comparator.comparing(DungeonRoom::roomId))
                .toList();
        List<DungeonRoom> results = new ArrayList<>();
        Set<Long> usedRoomIds = new LinkedHashSet<>();
        Map<Long, String> usedNames = new HashMap<>();
        for (DungeonRoom room : sortedExistingRooms) {
            usedNames.put(room.roomId(), room.name());
        }

        for (RoomShape shape : components) {
            DungeonRoom match = bestMatchingRoom(shape, sortedExistingRooms, usedRoomIds);
            if (match != null) {
                Point2i anchor = componentAnchor(shape, match.componentAnchor());
                DungeonRoomPersistenceRepository.updateRoom(conn, match.roomId(), match.name(), anchor);
                results.add(new DungeonRoom(match.roomId(), mapId, clusterId, match.name(), anchor));
                usedRoomIds.add(match.roomId());
                continue;
            }
            String roomName = nextAvailableRoomName(sortedExistingRooms, usedNames);
            Point2i anchor = componentAnchor(shape, shape.center());
            long roomId = DungeonRoomPersistenceRepository.insertRoom(conn, mapId, clusterId, roomName, anchor);
            usedNames.put(roomId, roomName);
            results.add(new DungeonRoom(roomId, mapId, clusterId, roomName, anchor));
        }

        for (DungeonRoom room : sortedExistingRooms) {
            if (!usedRoomIds.contains(room.roomId())) {
                corridorRoomReconciler.reconcileRoomCorridors(conn, mapId, room.roomId(), results);
                DungeonRoomPersistenceRepository.deleteRoom(conn, mapId, room.roomId());
            }
        }
        return List.copyOf(results);
    }

    static Point2i componentAnchor(RoomShape shape, Point2i preferredAnchor) {
        // Component anchors track the component's current geometric center so split/merge feedback stays stable in every view.
        return shape.center();
    }

    public static int manhattan(Point2i a, Point2i b) {
        return Math.abs(a.x() - b.x()) + Math.abs(a.y() - b.y());
    }

    public static int componentDistance(DungeonRoom room, Point2i cell) {
        return room == null || cell == null ? Integer.MAX_VALUE : manhattan(room.componentAnchor(), cell);
    }

    public static int componentDistance(DungeonRoom left, DungeonRoom right) {
        return left == null || right == null ? Integer.MAX_VALUE : componentDistance(left, right.componentAnchor());
    }

    private static DungeonRoom bestMatchingRoom(
            RoomShape component,
            List<DungeonRoom> rooms,
            Set<Long> usedRoomIds
    ) {
        DungeonRoom best = null;
        int bestOverlap = 0;
        int bestDistance = Integer.MAX_VALUE;
        for (DungeonRoom room : rooms) {
            if (usedRoomIds.contains(room.roomId())) {
                continue;
            }
            int overlap = component.cells().contains(room.componentAnchor()) ? 1 : 0;
            int distance = componentDistance(room, component.center());
            if (best == null || overlap > bestOverlap || (overlap == bestOverlap && distance < bestDistance)) {
                best = room;
                bestOverlap = overlap;
                bestDistance = distance;
            }
        }
        return best;
    }

    private static String nextAvailableRoomName(List<DungeonRoom> existingRooms, Map<Long, String> usedNames) {
        List<DungeonRoom> syntheticRooms = new ArrayList<>(existingRooms);
        for (Map.Entry<Long, String> entry : usedNames.entrySet()) {
            if (existingRooms.stream().anyMatch(room -> room.roomId() != null && room.roomId().equals(entry.getKey()))) {
                continue;
            }
            syntheticRooms.add(new DungeonRoom(entry.getKey(), 0L, 0L, entry.getValue(), new Point2i(0, 0)));
        }
        return DungeonRoomNaming.nextRoomName(syntheticRooms);
    }
}
