package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class RoomCorridorMutationApplier {

    private final DungeonCorridorWriteRepository corridorWriteRepository;

    RoomCorridorMutationApplier(DungeonCorridorWriteRepository corridorWriteRepository) {
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
    }

    void afterClusterUpdated(
            Connection conn,
            DungeonLayout layout,
            long clusterId,
            TileShape clusterShape,
            long roomId
    ) throws SQLException {
        if (layout == null) {
            return;
        }
        Room room = layout.findRoom(roomId);
        if (room == null) {
            return;
        }
        Point2i updatedCenter = clusterShape == null ? layout.findCluster(clusterId).center() : clusterShape.centerCell();
        Room updatedRoom = Room.resolved(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                new Floor(clusterShape),
                room.walls(),
                room.doors());
        CorridorPlanningInput oldInput = layout.corridorPlanningInput();
        CorridorPlanningInput newInput = planningInput(layout, Map.of(room.roomId(), updatedRoom), Map.of(clusterId, updatedCenter), Set.of());
        for (Corridor corridor : affectedCorridors(layout, Set.of(room.roomId()), Set.of(clusterId))) {
            persist(conn, corridor.withReanchoredBindings(oldInput, Map.of(clusterId, updatedCenter), Set.of()).replanned(newInput));
        }
    }

    void afterClusterDeleted(
            Connection conn,
            DungeonLayout layout,
            long clusterId,
            Set<Long> deletedRoomIds
    ) throws SQLException {
        if (layout == null) {
            return;
        }
        Set<Long> removedRoomIds = deletedRoomIds == null ? Set.of() : Set.copyOf(deletedRoomIds);
        CorridorPlanningInput oldInput = layout.corridorPlanningInput();
        CorridorPlanningInput newInput = planningInput(layout, Map.of(), Map.of(), removedRoomIds);
        for (Corridor corridor : affectedCorridors(layout, removedRoomIds, Set.of(clusterId))) {
            Corridor updated = corridor;
            for (Long roomId : removedRoomIds) {
                updated = updated.withRemovedRoom(roomId);
            }
            updated = updated.withReanchoredBindings(oldInput, Map.of(), Set.of(clusterId));
            persist(conn, updated.isPersistable() ? updated.replanned(newInput) : updated);
        }
    }

    void afterClusterSplit(
            Connection conn,
            DungeonLayout layout,
            long sourceClusterId,
            long sourceRoomId,
            List<InsertedFragment> fragments
    ) throws SQLException {
        if (layout == null || fragments == null || fragments.isEmpty()) {
            return;
        }
        Map<Long, Point2i> replacementCenters = new LinkedHashMap<>();
        Map<Long, Room> replacementRooms = new LinkedHashMap<>();
        for (InsertedFragment fragment : fragments) {
            replacementCenters.put(fragment.clusterId(), fragment.clusterShape().centerCell());
            replacementRooms.put(fragment.roomId(), fragment.asRoom(layout.mapId()));
        }
        CorridorPlanningInput oldInput = layout.corridorPlanningInput();
        CorridorPlanningInput newInput = planningInput(layout, replacementRooms, replacementCenters, Set.of(sourceRoomId));
        for (Corridor corridor : affectedCorridors(layout, Set.of(sourceRoomId), Set.of(sourceClusterId))) {
            Corridor updated = corridor;
            if (corridor.connectsRoom(sourceRoomId)) {
                InsertedFragment chosenFragment = chooseBestFragment(layout, corridor, sourceRoomId, fragments);
                updated = updated.withReplacedRoom(sourceRoomId, chosenFragment.roomId());
            }
            updated = updated.withReanchoredBindings(oldInput, replacementCenters, Set.of(sourceClusterId));
            persist(conn, updated.isPersistable() ? updated.replanned(newInput) : updated);
        }
    }

    private void persist(Connection conn, Corridor corridor) throws SQLException {
        if (corridor == null || corridor.corridorId() == null) {
            return;
        }
        corridorWriteRepository.replaceCorridorRooms(conn, corridor.corridorId(), corridor.roomIds());
        if (!corridor.isPersistable()) {
            return;
        }
        corridorWriteRepository.replaceCorridorWaypoints(conn, corridor.corridorId(), corridor.bindings().waypoints());
        corridorWriteRepository.replaceCorridorDoorBindings(conn, corridor.corridorId(), corridor.bindings().doorBindings());
    }

    private static List<Corridor> affectedCorridors(DungeonLayout layout, Set<Long> roomIds, Set<Long> clusterIds) {
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : layout.corridors()) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            boolean dependsOnRoom = roomIds.stream().anyMatch(corridor::connectsRoom);
            boolean dependsOnCluster = clusterIds.stream().anyMatch(corridor::dependsOnCluster);
            if (dependsOnRoom || dependsOnCluster) {
                result.add(corridor);
            }
        }
        return List.copyOf(result);
    }

    private static CorridorPlanningInput planningInput(
            DungeonLayout layout,
            Map<Long, Room> replacementRooms,
            Map<Long, Point2i> replacementCenters,
            Set<Long> removedRoomIds
    ) {
        Map<Long, Room> roomsById = new LinkedHashMap<>();
        Map<Long, Point2i> clusterCenters = new LinkedHashMap<>();
        Set<Long> removedRooms = removedRoomIds == null ? Set.of() : Set.copyOf(removedRoomIds);
        for (var cluster : layout.clusters()) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            clusterCenters.put(cluster.clusterId(), replacementCenters.getOrDefault(cluster.clusterId(), cluster.center()));
            for (Room room : cluster.rooms()) {
                if (room == null || room.roomId() == null || removedRooms.contains(room.roomId())) {
                    continue;
                }
                roomsById.put(room.roomId(), replacementRooms.getOrDefault(room.roomId(), room));
            }
        }
        roomsById.putAll(replacementRooms);
        for (Room room : replacementRooms.values()) {
            clusterCenters.put(room.clusterId(), replacementCenters.get(room.clusterId()));
        }
        return new CorridorPlanningInput(roomsById, clusterCenters);
    }

    private static InsertedFragment chooseBestFragment(
            DungeonLayout layout,
            Corridor corridor,
            long originalRoomId,
            List<InsertedFragment> fragments
    ) {
        InsertedFragment bestFragment = fragments.getFirst();
        FragmentScore bestScore = null;
        for (InsertedFragment fragment : fragments) {
            int nearestRoomDistance = corridor.roomIds().stream()
                    .filter(roomId -> roomId != originalRoomId)
                    .map(layout::findRoom)
                    .filter(Objects::nonNull)
                    .mapToInt(room -> fragment.roomAnchor().distanceTo(room.floor().shape().anchor()))
                    .min()
                    .orElse(Integer.MAX_VALUE);
            int groupDistance = corridor.roomIds().stream()
                    .filter(roomId -> roomId != originalRoomId)
                    .map(layout::findRoom)
                    .filter(Objects::nonNull)
                    .mapToInt(room -> fragment.roomAnchor().distanceTo(room.floor().shape().anchor()))
                    .sum();
            FragmentScore score = new FragmentScore(nearestRoomDistance, groupDistance);
            if (bestScore == null || score.compareTo(bestScore) < 0) {
                bestFragment = fragment;
                bestScore = score;
            }
        }
        return bestFragment;
    }

    record InsertedFragment(
            long clusterId,
            long roomId,
            String roomName,
            TileShape clusterShape,
            Point2i roomAnchor
    ) {
        Room asRoom(long mapId) {
            return Room.create(roomId, mapId, clusterId, roomName, new Floor(clusterShape));
        }
    }

    private record FragmentScore(int nearestRoomDistance, int groupDistance) implements Comparable<FragmentScore> {
        @Override
        public int compareTo(FragmentScore other) {
            int nearestComparison = Integer.compare(nearestRoomDistance, other.nearestRoomDistance);
            if (nearestComparison != 0) {
                return nearestComparison;
            }
            return Integer.compare(groupDistance, other.groupDistance);
        }
    }
}
