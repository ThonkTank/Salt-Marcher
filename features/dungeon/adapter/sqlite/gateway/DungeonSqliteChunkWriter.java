package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorDoorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterFloorCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairPathNodeRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.api.DungeonChunkKey;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

final class DungeonSqliteChunkWriter {
    private DungeonSqliteChunkWriter() {
    }

    static void replaceChunkInventory(Connection connection, DungeonMapRecord map) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.CHUNKS_TABLE + " WHERE dungeon_map_id=?")) {
            delete.setLong(1, map.mapId());
            delete.executeUpdate();
        }
        Set<ChunkCoordinate> chunks = authoredChunks(map);
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.CHUNKS_TABLE
                        + "(dungeon_map_id, level_z, chunk_q, chunk_r, revision) VALUES(?,?,?,?,?)")) {
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

    static void updateChunkInventory(
            Connection connection,
            DungeonMapRecord before,
            DungeonMapRecord after
    ) throws SQLException {
        Set<ChunkCoordinate> previous = authoredChunks(before);
        Set<ChunkCoordinate> current = authoredChunks(after);
        Set<ChunkCoordinate> removed = new LinkedHashSet<>(previous);
        removed.removeAll(current);
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.CHUNKS_TABLE
                        + " WHERE dungeon_map_id=? AND level_z=? AND chunk_q=? AND chunk_r=?")) {
            for (ChunkCoordinate chunk : removed) {
                delete.setLong(1, after.mapId());
                delete.setInt(2, chunk.level());
                delete.setInt(3, chunk.q());
                delete.setInt(4, chunk.r());
                delete.addBatch();
            }
            delete.executeBatch();
        }
        Set<ChunkCoordinate> added = new LinkedHashSet<>(current);
        added.removeAll(previous);
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.CHUNKS_TABLE
                        + "(dungeon_map_id, level_z, chunk_q, chunk_r, revision) VALUES(?,?,?,?,?)")) {
            for (ChunkCoordinate chunk : added) {
                insert.setLong(1, after.mapId());
                insert.setInt(2, chunk.level());
                insert.setInt(3, chunk.q());
                insert.setInt(4, chunk.r());
                insert.setLong(5, after.revision());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static Set<ChunkCoordinate> authoredChunks(DungeonMapRecord map) {
        Set<ChunkCoordinate> chunks = new LinkedHashSet<>();
        for (DungeonRoomClusterRecord cluster : map.roomClusters()) {
            for (DungeonRoomClusterFloorCellRecord cell : cluster.floorCells()) {
                add(chunks, cell.levelZ(), cell.cellX(), cell.cellY());
            }
            for (DungeonClusterBoundaryRecord edge : cluster.boundaries()) {
                add(chunks, edge.levelZ(), edge.cellX(), edge.cellY());
            }
        }
        Map<Long, DungeonRoomClusterRecord> clustersById = new LinkedHashMap<>();
        for (DungeonRoomClusterRecord cluster : map.roomClusters()) {
            clustersById.put(cluster.clusterId(), cluster);
        }
        for (DungeonCorridorRecord corridor : map.corridors()) {
            for (DungeonCorridorWaypointRecord waypoint : corridor.waypoints()) {
                DungeonRoomClusterRecord cluster = clustersById.get(waypoint.clusterId());
                if (cluster != null) {
                    add(
                            chunks,
                            cluster.levelZ() + waypoint.relativeZ(),
                            cluster.centerX() + waypoint.relativeX(),
                            cluster.centerY() + waypoint.relativeY());
                }
            }
            for (DungeonCorridorDoorBindingRecord door : corridor.doorBindings()) {
                DungeonRoomClusterRecord cluster = clustersById.get(door.clusterId());
                if (cluster != null) {
                    add(
                            chunks,
                            cluster.levelZ(),
                            cluster.centerX() + door.relativeCellX(),
                            cluster.centerY() + door.relativeCellY());
                }
            }
            for (DungeonCorridorAnchorBindingRecord anchor : corridor.anchorBindings()) {
                add(chunks, anchor.cellZ(), anchor.cellX(), anchor.cellY());
            }
        }
        for (DungeonFeatureMarkerRecord marker : map.featureMarkers()) {
            add(chunks, marker.levelZ(), marker.cellX(), marker.cellY());
        }
        for (DungeonStairRecord stair : map.stairs()) {
            for (DungeonStairPathNodeRecord node : stair.pathNodes()) {
                add(chunks, node.cellZ(), node.cellX(), node.cellY());
            }
            for (DungeonStairExitRecord exit : stair.exits()) {
                add(chunks, exit.cellZ(), exit.cellX(), exit.cellY());
            }
        }
        for (DungeonTransitionRecord transition : map.transitions()) {
            if (transition.cellX() != null && transition.cellY() != null && transition.levelZ() != null) {
                add(chunks, transition.levelZ(), transition.cellX(), transition.cellY());
            }
        }
        return Set.copyOf(chunks);
    }

    private static void add(Set<ChunkCoordinate> chunks, int level, int q, int r) {
        chunks.add(new ChunkCoordinate(
                level,
                Math.floorDiv(q, DungeonChunkKey.CHUNK_SIZE),
                Math.floorDiv(r, DungeonChunkKey.CHUNK_SIZE)));
    }

    private record ChunkCoordinate(int level, int q, int r) {
    }
}
