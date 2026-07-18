package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorDoorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairPathNodeRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.api.DungeonChunkKey;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonSqliteChunkWriter {

    private static final String ROOM = "ROOM";
    private static final String ROOM_CLUSTER = "ROOM_CLUSTER";
    private static final String CORRIDOR = "CORRIDOR";
    private static final String STAIR = "STAIR";
    private static final String TRANSITION = "TRANSITION";
    private static final String FEATURE_MARKER = "FEATURE_MARKER";

    private DungeonSqliteChunkWriter() {
    }

    static void replaceChunkInventory(Connection connection, DungeonMapRecord map) throws SQLException {
        replaceSpatialIndex(connection, map);
    }

    static void updateChunkInventory(
            Connection connection,
            DungeonMapRecord ignoredBefore,
            DungeonMapRecord after
    ) throws SQLException {
        replaceSpatialIndex(connection, after);
    }

    private static void replaceSpatialIndex(Connection connection, DungeonMapRecord map) throws SQLException {
        Map<EntityKey, Set<ChunkCoordinate>> memberships = authoredMemberships(map);
        List<ChunkCoordinate> chunks = orderedChunks(memberships);
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.CHUNKS_TABLE + " WHERE dungeon_map_id=?")) {
            delete.setLong(1, map.mapId());
            delete.executeUpdate();
        }
        insertChunks(connection, map, chunks);
        insertMemberships(connection, map.mapId(), memberships);
    }

    private static void insertChunks(
            Connection connection,
            DungeonMapRecord map,
            List<ChunkCoordinate> chunks
    ) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.CHUNKS_TABLE
                        + "(dungeon_map_id, level_z, chunk_q, chunk_r, content_revision) VALUES(?,?,?,?,?)")) {
            for (ChunkCoordinate chunk : chunks) {
                insert.setLong(1, map.mapId());
                insert.setInt(2, chunk.level());
                insert.setInt(3, chunk.q());
                insert.setInt(4, chunk.r());
                insert.setLong(5, map.revision());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void insertMemberships(
            Connection connection,
            long mapId,
            Map<EntityKey, Set<ChunkCoordinate>> memberships
    ) throws SQLException {
        List<Membership> ordered = orderedMemberships(memberships);
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE
                        + "(dungeon_map_id, entity_kind, entity_id, level_z, chunk_q, chunk_r)"
                        + " VALUES(?,?,?,?,?,?)")) {
            for (Membership membership : ordered) {
                insert.setLong(1, mapId);
                insert.setString(2, membership.entity().kind());
                insert.setLong(3, membership.entity().id());
                insert.setInt(4, membership.chunk().level());
                insert.setInt(5, membership.chunk().q());
                insert.setInt(6, membership.chunk().r());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static Map<EntityKey, Set<ChunkCoordinate>> authoredMemberships(DungeonMapRecord map) {
        Map<EntityKey, Set<ChunkCoordinate>> memberships = new LinkedHashMap<>();
        for (DungeonRoomRecord room : map.rooms()) {
            EntityKey entity = new EntityKey(ROOM, room.roomId());
            for (DungeonRoomCellRecord cell : room.floorCells()) {
                add(memberships, entity, cell.levelZ(), cell.cellX(), cell.cellY());
            }
        }
        for (DungeonRoomClusterRecord cluster : map.roomClusters()) {
            EntityKey entity = new EntityKey(ROOM_CLUSTER, cluster.clusterId());
            for (DungeonClusterBoundaryRecord boundary : cluster.boundaries()) {
                add(memberships, entity, boundary.levelZ(), boundary.cellX(), boundary.cellY());
            }
        }
        Map<Long, DungeonRoomClusterRecord> clustersById = clustersById(map.roomClusters());
        for (DungeonCorridorRecord corridor : map.corridors()) {
            EntityKey entity = new EntityKey(CORRIDOR, corridor.corridorId());
            addCorridorMembership(memberships, entity, corridor, clustersById);
        }
        for (DungeonFeatureMarkerRecord marker : map.featureMarkers()) {
            add(memberships, new EntityKey(FEATURE_MARKER, marker.markerId()),
                    marker.levelZ(), marker.cellX(), marker.cellY());
        }
        for (DungeonStairRecord stair : map.stairs()) {
            EntityKey entity = new EntityKey(STAIR, stair.stairId());
            for (DungeonStairPathNodeRecord node : stair.pathNodes()) {
                add(memberships, entity, node.cellZ(), node.cellX(), node.cellY());
            }
            for (DungeonStairExitRecord exit : stair.exits()) {
                add(memberships, entity, exit.cellZ(), exit.cellX(), exit.cellY());
            }
        }
        for (DungeonTransitionRecord transition : map.transitions()) {
            if (transition.cellX() != null && transition.cellY() != null && transition.levelZ() != null) {
                add(memberships, new EntityKey(TRANSITION, transition.transitionId()),
                        transition.levelZ(), transition.cellX(), transition.cellY());
            }
        }
        return copyMemberships(memberships);
    }

    private static void addCorridorMembership(
            Map<EntityKey, Set<ChunkCoordinate>> memberships,
            EntityKey entity,
            DungeonCorridorRecord corridor,
            Map<Long, DungeonRoomClusterRecord> clustersById
    ) {
        for (DungeonCorridorWaypointRecord waypoint : corridor.waypoints()) {
            DungeonRoomClusterRecord cluster = clustersById.get(waypoint.clusterId());
            if (cluster != null) {
                add(memberships, entity,
                        waypoint.relativeZ(),
                        cluster.centerX() + waypoint.relativeX(),
                        cluster.centerY() + waypoint.relativeY());
            }
        }
        for (DungeonCorridorDoorBindingRecord door : corridor.doorBindings()) {
            DungeonRoomClusterRecord cluster = clustersById.get(door.clusterId());
            if (cluster != null) {
                add(memberships, entity,
                        cluster.levelZ(),
                        cluster.centerX() + door.relativeCellX(),
                        cluster.centerY() + door.relativeCellY());
            }
        }
        for (DungeonCorridorAnchorBindingRecord anchor : corridor.anchorBindings()) {
            add(memberships, entity, anchor.cellZ(), anchor.cellX(), anchor.cellY());
        }
    }

    private static Map<Long, DungeonRoomClusterRecord> clustersById(List<DungeonRoomClusterRecord> clusters) {
        Map<Long, DungeonRoomClusterRecord> result = new LinkedHashMap<>();
        for (DungeonRoomClusterRecord cluster : clusters) {
            result.put(cluster.clusterId(), cluster);
        }
        return Map.copyOf(result);
    }

    private static void add(
            Map<EntityKey, Set<ChunkCoordinate>> memberships,
            EntityKey entity,
            int level,
            int q,
            int r
    ) {
        memberships.computeIfAbsent(entity, ignored -> new LinkedHashSet<>())
                .add(new ChunkCoordinate(
                        level,
                        Math.floorDiv(q, DungeonChunkKey.CHUNK_SIZE),
                        Math.floorDiv(r, DungeonChunkKey.CHUNK_SIZE)));
    }

    private static Map<EntityKey, Set<ChunkCoordinate>> copyMemberships(
            Map<EntityKey, Set<ChunkCoordinate>> source
    ) {
        Map<EntityKey, Set<ChunkCoordinate>> result = new LinkedHashMap<>();
        source.forEach((entity, chunks) -> result.put(entity, Set.copyOf(chunks)));
        return Map.copyOf(result);
    }

    private static List<ChunkCoordinate> orderedChunks(Map<EntityKey, Set<ChunkCoordinate>> memberships) {
        Set<ChunkCoordinate> unique = new LinkedHashSet<>();
        memberships.values().forEach(unique::addAll);
        List<ChunkCoordinate> result = new ArrayList<>(unique);
        result.sort(ChunkCoordinate.ORDER);
        return List.copyOf(result);
    }

    private static List<Membership> orderedMemberships(Map<EntityKey, Set<ChunkCoordinate>> memberships) {
        List<Membership> result = new ArrayList<>();
        memberships.forEach((entity, chunks) -> chunks.forEach(chunk -> result.add(new Membership(entity, chunk))));
        result.sort(Membership.ORDER);
        return List.copyOf(result);
    }

    private record EntityKey(String kind, long id) {
    }

    private record ChunkCoordinate(int level, int q, int r) {
        private static final Comparator<ChunkCoordinate> ORDER = Comparator
                .comparingInt(ChunkCoordinate::level)
                .thenComparingInt(ChunkCoordinate::r)
                .thenComparingInt(ChunkCoordinate::q);
    }

    private record Membership(EntityKey entity, ChunkCoordinate chunk) {
        private static final Comparator<Membership> ORDER = Comparator
                .comparing((Membership value) -> value.entity().kind())
                .thenComparingLong(value -> value.entity().id())
                .thenComparing(value -> value.chunk(), ChunkCoordinate.ORDER);
    }
}
