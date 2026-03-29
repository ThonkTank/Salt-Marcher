package features.world.dungeonmap.persistence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

public final class DungeonTraversalCorridorSegmentWriteRepository {

    public Map<String, Long> loadTraversalSegments(Connection conn, long traversalId) throws SQLException {
        LinkedHashMap<String, Long> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT segment_key, corridor_id"
                        + " FROM dungeon_traversal_corridor_segments"
                        + " WHERE traversal_id=?"
                        + " ORDER BY sort_order, segment_key")) {
            ps.setLong(1, traversalId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String segmentKey = normalizeSegmentKey(rs.getString("segment_key"));
                    long corridorId = rs.getLong("corridor_id");
                    if (segmentKey != null) {
                        result.put(segmentKey, corridorId);
                    }
                }
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    public List<Long> replaceTraversalSegments(Connection conn, long traversalId, Map<String, Long> corridorIdsBySegmentKey) throws SQLException {
        Map<String, Long> desired = normalize(corridorIdsBySegmentKey);
        Map<String, Long> existing = loadTraversalSegments(conn, traversalId);
        LinkedHashSet<Long> removedIds = new LinkedHashSet<>(existing.values());
        removedIds.removeAll(desired.values());
        deleteTraversalSegments(conn, traversalId);
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_traversal_corridor_segments(traversal_id, segment_key, corridor_id, sort_order) VALUES(?,?,?,?)")) {
            int sortOrder = 0;
            for (Map.Entry<String, Long> entry : desired.entrySet()) {
                insert.setLong(1, traversalId);
                insert.setString(2, entry.getKey());
                insert.setLong(3, entry.getValue());
                insert.setInt(4, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
        return removedIds.isEmpty() ? List.of() : List.copyOf(removedIds);
    }

    public List<Long> deleteTraversalSegments(Connection conn, long traversalId) throws SQLException {
        List<Long> existingIds = new ArrayList<>(loadTraversalSegments(conn, traversalId).values());
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_traversal_corridor_segments WHERE traversal_id=?")) {
            delete.setLong(1, traversalId);
            delete.executeUpdate();
        }
        return existingIds.isEmpty() ? List.of() : List.copyOf(existingIds);
    }

    private static Map<String, Long> normalize(Map<String, Long> raw) {
        if (raw == null || raw.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, Long> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Long> entry : raw.entrySet()) {
            String segmentKey = normalizeSegmentKey(entry.getKey());
            Long corridorId = entry.getValue();
            if (segmentKey != null && corridorId != null) {
                normalized.put(segmentKey, corridorId);
            }
        }
        return normalized.isEmpty() ? Map.of() : Map.copyOf(normalized);
    }

    private static String normalizeSegmentKey(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
