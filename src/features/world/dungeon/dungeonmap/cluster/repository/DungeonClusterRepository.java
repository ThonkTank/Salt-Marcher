package features.world.dungeon.dungeonmap.cluster.repository;

import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.cluster.model.ClusterDefinitionRequest;
import features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonClusterRepository {

    private final features.world.dungeon.dungeonmap.structure.repository.DungeonStructureRepository structureRepository = new features.world.dungeon.dungeonmap.structure.repository.DungeonStructureRepository();

    public List<Cluster> loadClusters(Connection conn, long mapId, List<features.world.dungeon.model.structures.room.Room> rooms) throws SQLException {
        List<Cluster> clusters = new ArrayList<>();
        Map<Long, List<features.world.dungeon.model.structures.room.Room>> roomsByClusterId = roomsByClusterId(rooms);
        Map<Long, Long> structureIdsByClusterId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, structure_object_id FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    structureIdsByClusterId.put(rs.getLong("cluster_id"), rs.getLong("structure_object_id"));
                }
            }
        }
        Map<Long, features.world.dungeon.dungeonmap.structure.model.Structure> structuresById = structureRepository.loadByIds(conn, structureIdsByClusterId.values());
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, structure_object_id FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    long structureObjectId = rs.getLong("structure_object_id");
                    features.world.dungeon.dungeonmap.structure.model.Structure structure = structuresById.get(structureObjectId);
                    if (structure == null || structure.levels().isEmpty()) {
                        throw new IllegalStateException("Cluster " + clusterId + " hat keine persistierte Strukturbeschreibung");
                    }
                    clusters.add(Cluster.fromDefinition(new ClusterDefinitionRequest(
                            clusterId,
                            structureObjectId,
                            rs.getLong("dungeon_map_id"),
                            structure,
                            roomsByClusterId.getOrDefault(clusterId, List.of()))));
                }
            }
        }
        return clusters.isEmpty() ? List.of() : List.copyOf(clusters);
    }

    public Map<Long, Integer> loadClusterLevels(Connection conn, long mapId) throws SQLException {
        return loadLevelMap(conn,
                "SELECT c.cluster_id AS entity_id, MIN(sl.level_z) AS level_z"
                        + " FROM dungeon_room_clusters c"
                        + " JOIN dungeon_structure_levels sl ON sl.structure_object_id=c.structure_object_id"
                        + " WHERE c.dungeon_map_id=?"
                        + " GROUP BY c.cluster_id",
                mapId);
    }

    /**
     * Canonical cluster persistence seam: realize one final rewrite payload directly into persisted cluster rows
     * and shared structure state, returning the persisted cluster ids in final-cluster order for parent-owned
     * room metadata writes.
     */
    public List<Long> persistRewrite(
            Connection conn,
            long mapId,
            ClusterRewriteRequest rewriteRequest
    ) throws SQLException {
        if (rewriteRequest == null) {
            return List.of();
        }
        List<Cluster> resolvedOriginalClusters = normalizedClusters(rewriteRequest.originalClusters());
        List<Cluster> resolvedFinalClusters = normalizedClusters(rewriteRequest.rewrittenClusters());
        if (resolvedOriginalClusters.isEmpty() && resolvedFinalClusters.isEmpty()) {
            return List.of();
        }

        Set<Long> retainedClusterIds = new LinkedHashSet<>();
        List<Long> persistedClusterIds = new ArrayList<>(resolvedFinalClusters.size());
        for (Cluster cluster : resolvedFinalClusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() != null) {
                retainedClusterIds.add(cluster.clusterId());
                if (cluster.structureObjectId() == null || cluster.structureObjectId() <= 0L) {
                    throw new IllegalArgumentException("Persisted cluster requires a structure object id");
                }
                structureRepository.save(conn, cluster.structureObjectId(), cluster);
                persistedClusterIds.add(cluster.clusterId());
                continue;
            }
            features.world.dungeon.dungeonmap.structure.repository.DungeonStructureRepository.PersistedStructure persistedStructure =
                    structureRepository.save(conn, null, cluster);
            long clusterId = insertCluster(conn, mapId, persistedStructure.structureObjectId());
            persistedClusterIds.add(clusterId);
        }

        for (Cluster cluster : resolvedOriginalClusters) {
            if (cluster == null || cluster.clusterId() == null || retainedClusterIds.contains(cluster.clusterId())) {
                continue;
            }
            deleteCluster(conn, cluster.clusterId());
            structureRepository.delete(conn, cluster.structureObjectId());
        }
        return persistedClusterIds.isEmpty() ? List.of() : List.copyOf(persistedClusterIds);
    }

    private long insertCluster(Connection conn, long mapId, long structureObjectId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_room_clusters(dungeon_map_id, structure_object_id) VALUES(?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, structureObjectId);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_room_clusters insert");
                }
                return rs.getLong(1);
            }
        }
    }

    private void deleteCluster(Connection conn, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_room_clusters WHERE cluster_id=?")) {
            ps.setLong(1, clusterId);
            ps.executeUpdate();
        }
    }

    private static Map<Long, Integer> loadLevelMap(Connection conn, String sql, long mapId) throws SQLException {
        Map<Long, Integer> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.put(rs.getLong("entity_id"), rs.getInt("level_z"));
                }
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Long, List<features.world.dungeon.model.structures.room.Room>> roomsByClusterId(List<features.world.dungeon.model.structures.room.Room> rooms) {
        Map<Long, List<features.world.dungeon.model.structures.room.Room>> result = new LinkedHashMap<>();
        for (features.world.dungeon.model.structures.room.Room room : rooms == null ? List.<features.world.dungeon.model.structures.room.Room>of() : rooms) {
            if (room != null) {
                result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<Cluster> normalizedClusters(List<Cluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        List<Cluster> result = new ArrayList<>();
        Set<Long> seenClusterIds = new LinkedHashSet<>();
        for (Cluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() == null) {
                result.add(cluster);
                continue;
            }
            if (seenClusterIds.add(cluster.clusterId())) {
                result.add(cluster);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

}
