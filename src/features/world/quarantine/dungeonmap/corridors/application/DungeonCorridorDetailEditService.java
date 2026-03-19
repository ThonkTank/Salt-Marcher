package features.world.quarantine.dungeonmap.corridors.application;
import features.world.quarantine.dungeonmap.layout.application.DungeonTopologyEditResultLoader;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.corridors.model.binding.CorridorWaypoint;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorDoorReassignment;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.corridors.persistence.DungeonCorridorPersistenceRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.BiConsumer;

public final class DungeonCorridorDetailEditService {

    public DungeonLayoutEditResult moveCorridorDoor(
            Connection conn,
            DungeonLayout layout,
            long mapId,
            long corridorId,
            long roomId,
            Point2i cell,
            DungeonRoomCluster.EdgeDirection direction
    ) throws SQLException {
        DungeonCorridor corridor = DungeonTopologyEditResultLoader.requireCorridor(layout, corridorId);
        if (!corridor.roomIds().contains(roomId)) {
            throw new IllegalArgumentException("Raum " + roomId + " gehört nicht zu Korridor " + corridorId);
        }
        if (cell == null || direction == null) {
            throw new IllegalArgumentException("Tür-Override muss auf einer gültigen Raumkante liegen");
        }
        DungeonRoom targetRoom = layout.roomAtCell(cell);
        if (targetRoom == null) {
            throw new IllegalArgumentException("Tür-Override muss auf einer gültigen Raumkante liegen");
        }
        validateDoorMoveTarget(layout, corridorId, targetRoom.roomId(), cell, direction);
        DungeonRoomCluster cluster = layout.findCluster(targetRoom.clusterId());
        DungeonCorridorDoorReassignment.DoorMoveUpdate update = DungeonCorridorDoorReassignment.reassignDoor(
                corridor, roomId, targetRoom, cluster, cell, direction);
        DungeonCorridorPersistenceRepository.replaceCorridorRooms(conn, mapId, corridorId, update.roomIds());
        DungeonCorridorPersistenceRepository.replaceCorridorDoorOverrides(conn, mapId, corridorId, update.doorOverrides());
        return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, corridorId);
    }

    private static void validateDoorMoveTarget(
            DungeonLayout layout,
            long corridorId,
            long targetRoomId,
            Point2i targetCell,
            DungeonRoomCluster.EdgeDirection direction
    ) {
        Point2i outsideCell = targetCell.add(direction.delta());
        if (layout.roomCells(targetRoomId).contains(outsideCell)) {
            throw new IllegalArgumentException("Tür-Override muss auf einer exponierten Raumkante liegen");
        }
        if (isOccupiedByOtherRoom(layout, targetRoomId, outsideCell)) {
            throw new IllegalArgumentException("Tür-Override muss auf einer freien exponierten Raumkante liegen");
        }
        if (layout.clusterForRoom(targetRoomId) == null) {
            throw new IllegalArgumentException("Referenz-Cluster für Raum fehlt: " + targetRoomId);
        }
    }

    public DungeonLayoutEditResult resetCorridorDoor(Connection conn, DungeonLayout layout, long mapId, long corridorId, long roomId) throws SQLException {
        DungeonCorridorPersistenceRepository.deleteCorridorDoorOverride(conn, corridorId, roomId);
        return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, corridorId);
    }

    public DungeonLayoutEditResult addCorridorWaypoint(
            Connection conn,
            DungeonLayout layout,
            long mapId,
            long corridorId,
            int insertIndex,
            Point2i cell
    ) throws SQLException {
        DungeonCorridor corridor = DungeonTopologyEditResultLoader.requireCorridor(layout, corridorId);
        CorridorWaypoint waypoint = waypointForCell(layout, corridor, cell);
        return mutateCorridorWaypoints(conn, layout, mapId, corridorId, (waypoints, c) ->
                waypoints.add(Math.max(0, Math.min(insertIndex, waypoints.size())), waypoint));
    }

    public DungeonLayoutEditResult moveCorridorWaypoint(
            Connection conn,
            DungeonLayout layout,
            long mapId,
            long corridorId,
            int waypointIndex,
            Point2i cell
    ) throws SQLException {
        return mutateCorridorWaypoints(conn, layout, mapId, corridorId, (waypoints, corridor) -> {
            if (waypointIndex < 0 || waypointIndex >= waypoints.size()) {
                throw new IllegalArgumentException("Ungültiger Korridor-Zwischenpunkt: " + waypointIndex);
            }
            CorridorWaypoint previous = waypoints.get(waypointIndex);
            DungeonRoomCluster cluster = layout.findCluster(previous.clusterId());
            if (cluster == null) {
                throw new IllegalArgumentException("Referenz-Cluster für Zwischenpunkt fehlt: " + previous.clusterId());
            }
            waypoints.set(waypointIndex, new CorridorWaypoint(previous.clusterId(), cell.subtract(cluster.center())));
        });
    }

    public DungeonLayoutEditResult deleteCorridorWaypoint(Connection conn, DungeonLayout layout, long mapId, long corridorId, int waypointIndex) throws SQLException {
        return mutateCorridorWaypoints(conn, layout, mapId, corridorId, (waypoints, corridor) -> {
            if (waypointIndex < 0 || waypointIndex >= waypoints.size()) {
                throw new IllegalArgumentException("Ungültiger Korridor-Zwischenpunkt: " + waypointIndex);
            }
            waypoints.remove(waypointIndex);
        });
    }

    private DungeonLayoutEditResult mutateCorridorWaypoints(
            Connection conn,
            DungeonLayout layout,
            long mapId,
            long corridorId,
            BiConsumer<List<CorridorWaypoint>, DungeonCorridor> mutation
    ) throws SQLException {
        DungeonCorridor corridor = DungeonTopologyEditResultLoader.requireCorridor(layout, corridorId);
        List<CorridorWaypoint> waypoints = new ArrayList<>(corridor.waypoints());
        mutation.accept(waypoints, corridor);
        DungeonCorridorPersistenceRepository.replaceCorridorWaypoints(conn, mapId, corridorId, waypoints);
        return DungeonTopologyEditResultLoader.loadCorridorEditResult(conn, mapId, corridorId);
    }

    private static boolean isOccupiedByOtherRoom(DungeonLayout layout, long roomId, Point2i cell) {
        if (layout == null || cell == null) return false;
        DungeonRoom occupant = layout.roomAtCell(cell);
        return occupant != null && occupant.roomId() != null && occupant.roomId() != roomId;
    }

    private static CorridorWaypoint waypointForCell(DungeonLayout layout, DungeonCorridor corridor, Point2i cell) {
        if (layout == null || corridor == null || cell == null) {
            throw new IllegalArgumentException("Waypoint braucht Layout, Korridor und Zielzelle");
        }
        DungeonRoom bestRoom = corridor.roomIds().stream()
                .map(layout::findRoom)
                .filter(Objects::nonNull)
                .min(Comparator.comparingInt(room -> room.componentAnchor().distanceTo(cell)))
                .orElseThrow(() -> new IllegalArgumentException("Korridor braucht mindestens einen Raum"));
        DungeonRoomCluster cluster = layout.findCluster(bestRoom.clusterId());
        if (cluster == null) {
            throw new IllegalArgumentException("Cluster für Raum " + bestRoom.roomId() + " fehlt");
        }
        return new CorridorWaypoint(cluster.clusterId(), cell.subtract(cluster.center()));
    }

}
