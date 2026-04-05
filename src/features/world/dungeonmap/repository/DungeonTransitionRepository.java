package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.connection.StairConnectionCarrier;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.model.objects.Door;

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

public final class DungeonTransitionRepository {

    private static final String SELECT_COLUMNS =
            "SELECT transition_id, dungeon_map_id, description, placement_type,"
                    + " door_level_z, door_start_x2, door_start_y2, door_end_x2, door_end_y2, door_endpoint_type, door_endpoint_id,"
                    + " stair_anchor_cell_x, stair_anchor_cell_y, stair_anchor_level_z, stair_shape, stair_direction_code,"
                    + " stair_dimension1, stair_dimension2, stair_min_level_z, stair_max_level_z,"
                    + " destination_type, target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                    + " target_transition_id, linked_transition_id";

    public List<DungeonTransition> loadByMap(Connection conn, long mapId) throws SQLException {
        Map<Long, List<CubePoint>> pathByTransitionId = loadGrouped(
                conn,
                "SELECT transition_id, cell_x, cell_y, cell_z"
                        + " FROM dungeon_transition_stair_path_nodes"
                        + " WHERE transition_id IN (SELECT transition_id FROM dungeon_transitions WHERE dungeon_map_id=?)"
                        + " ORDER BY transition_id, sort_order",
                mapId,
                rs -> rs.getLong("transition_id"),
                rs -> new CubePoint(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("cell_z")));
        Map<Long, Set<Integer>> stopLevelsByTransitionId = loadStopLevelsByTransitionId(conn, mapId);
        try (PreparedStatement ps = conn.prepareStatement(
                SELECT_COLUMNS + " FROM dungeon_transitions WHERE dungeon_map_id=? ORDER BY transition_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonTransition> result = new ArrayList<>();
                while (rs.next()) {
                    long transitionId = rs.getLong("transition_id");
                    result.add(mapTransition(
                            rs,
                            pathByTransitionId.getOrDefault(transitionId, List.of()),
                            stopLevelsByTransitionId.getOrDefault(transitionId, Set.of())));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
        }
    }

    public List<DungeonTransition> loadPlacedByMap(Connection conn, long mapId) throws SQLException {
        return loadByMap(conn, mapId).stream()
                .filter(DungeonTransition::isPlaced)
                .toList();
    }

    public DungeonTransition find(Connection conn, long transitionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                SELECT_COLUMNS + " FROM dungeon_transitions WHERE transition_id=?")) {
            ps.setLong(1, transitionId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return mapTransition(rs, loadPathNodes(conn, transitionId), loadStopLevels(conn, transitionId));
            }
        }
    }

    public long nextTransitionId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COALESCE(MAX(transition_id), 0) + 1 AS next_id FROM dungeon_transitions")) {
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Nächste Transition-ID konnte nicht bestimmt werden");
                }
                return rs.getLong("next_id");
            }
        }
    }

    public long insert(Connection conn, DungeonTransition transition) throws SQLException {
        if (transition != null && transition.transitionId() != null) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO dungeon_transitions("
                            + "transition_id, dungeon_map_id, description, placement_type,"
                            + "door_level_z, door_start_x2, door_start_y2, door_end_x2, door_end_y2, door_endpoint_type, door_endpoint_id,"
                            + "stair_anchor_cell_x, stair_anchor_cell_y, stair_anchor_level_z, stair_shape, stair_direction_code,"
                            + "stair_dimension1, stair_dimension2, stair_min_level_z, stair_max_level_z,"
                            + "destination_type, target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                            + "target_transition_id, linked_transition_id"
                            + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
                ps.setLong(1, transition.transitionId());
                bindTransition(ps, transition, 2);
                ps.executeUpdate();
                replaceCarrierDetails(conn, transition.transitionId(), transition == null ? null : transition.localConnection());
                return transition.transitionId();
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_transitions("
                        + "dungeon_map_id, description, placement_type,"
                        + "door_level_z, door_start_x2, door_start_y2, door_end_x2, door_end_y2, door_endpoint_type, door_endpoint_id,"
                        + "stair_anchor_cell_x, stair_anchor_cell_y, stair_anchor_level_z, stair_shape, stair_direction_code,"
                        + "stair_dimension1, stair_dimension2, stair_min_level_z, stair_max_level_z,"
                        + "destination_type, target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                        + "target_transition_id, linked_transition_id"
                        + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            bindTransition(ps, transition, 1);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No key returned for dungeon_transitions insert");
                }
                long transitionId = keys.getLong(1);
                replaceCarrierDetails(conn, transitionId, transition == null ? null : transition.localConnection());
                return transitionId;
            }
        }
    }

    public void updateLocalConnection(Connection conn, long transitionId, DungeonConnection localConnection) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_transitions SET "
                        + "placement_type=?,"
                        + "door_level_z=?, door_start_x2=?, door_start_y2=?, door_end_x2=?, door_end_y2=?, door_endpoint_type=?, door_endpoint_id=?,"
                        + "stair_anchor_cell_x=?, stair_anchor_cell_y=?, stair_anchor_level_z=?, stair_shape=?, stair_direction_code=?,"
                        + "stair_dimension1=?, stair_dimension2=?, stair_min_level_z=?, stair_max_level_z=? "
                        + "WHERE transition_id=?")) {
            bindLocalConnection(ps, localConnection);
            ps.setLong(18, transitionId);
            ps.executeUpdate();
        }
        replaceCarrierDetails(conn, transitionId, localConnection);
    }

    public void linkPair(Connection conn, long transitionId, long counterpartId) throws SQLException {
        updateTargetTransition(conn, transitionId, counterpartId);
        updateLinkedTransition(conn, transitionId, counterpartId);
    }

    private void updateTargetTransition(Connection conn, long transitionId, Long targetTransitionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_transitions SET target_transition_id=? WHERE transition_id=?")) {
            if (targetTransitionId == null) {
                ps.setNull(1, java.sql.Types.INTEGER);
            } else {
                ps.setLong(1, targetTransitionId);
            }
            ps.setLong(2, transitionId);
            ps.executeUpdate();
        }
    }

    private void updateLinkedTransition(Connection conn, long transitionId, Long linkedTransitionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_transitions SET linked_transition_id=? WHERE transition_id=?")) {
            if (linkedTransitionId == null) {
                ps.setNull(1, java.sql.Types.INTEGER);
            } else {
                ps.setLong(1, linkedTransitionId);
            }
            ps.setLong(2, transitionId);
            ps.executeUpdate();
        }
    }

    public void clearLinksTo(Connection conn, long transitionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_transitions"
                        + " SET target_transition_id=CASE WHEN target_transition_id=? THEN NULL ELSE target_transition_id END,"
                        + " linked_transition_id=CASE WHEN linked_transition_id=? THEN NULL ELSE linked_transition_id END"
                        + " WHERE target_transition_id=? OR linked_transition_id=?")) {
            ps.setLong(1, transitionId);
            ps.setLong(2, transitionId);
            ps.setLong(3, transitionId);
            ps.setLong(4, transitionId);
            ps.executeUpdate();
        }
    }

    public boolean dungeonMapExists(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public void delete(Connection conn, long transitionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_transitions WHERE transition_id=?")) {
            ps.setLong(1, transitionId);
            ps.executeUpdate();
        }
    }

    private void replaceCarrierDetails(Connection conn, long transitionId, DungeonConnection localConnection) throws SQLException {
        StairConnectionCarrier stairCarrier = localConnection == null ? null : localConnection.stairCarrier();
        replacePathNodes(conn, transitionId, stairCarrier == null ? List.of() : stairCarrier.path());
        replaceStopLevels(conn, transitionId, stairCarrier == null ? Set.of() : stairCarrier.stopLevels());
    }

    private void replacePathNodes(Connection conn, long transitionId, List<CubePoint> pathNodes) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_transition_stair_path_nodes WHERE transition_id=?")) {
            delete.setLong(1, transitionId);
            delete.executeUpdate();
        }
        if (pathNodes == null || pathNodes.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_transition_stair_path_nodes(transition_id, sort_order, cell_x, cell_y, cell_z)"
                        + " VALUES(?,?,?,?,?)")) {
            for (int index = 0; index < pathNodes.size(); index++) {
                CubePoint node = pathNodes.get(index);
                insert.setLong(1, transitionId);
                insert.setInt(2, index);
                insert.setInt(3, node.x());
                insert.setInt(4, node.y());
                insert.setInt(5, node.z());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private void replaceStopLevels(Connection conn, long transitionId, Set<Integer> stopLevels) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_transition_stair_stop_levels WHERE transition_id=?")) {
            delete.setLong(1, transitionId);
            delete.executeUpdate();
        }
        if (stopLevels == null || stopLevels.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_transition_stair_stop_levels(transition_id, level_z) VALUES(?,?)")) {
            for (Integer stopLevel : stopLevels) {
                if (stopLevel == null) {
                    continue;
                }
                insert.setLong(1, transitionId);
                insert.setInt(2, stopLevel);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static DungeonTransition mapTransition(
            ResultSet rs,
            List<CubePoint> pathNodes,
            Set<Integer> stopLevels
    ) throws SQLException {
        long transitionId = rs.getLong("transition_id");
        long mapId = rs.getLong("dungeon_map_id");
        return new DungeonTransition(
                transitionId,
                mapId,
                rs.getString("description"),
                mapLocalConnection(rs, pathNodes, stopLevels, transitionId, mapId),
                mapDestination(rs),
                nullableLong(rs, "linked_transition_id"));
    }

    private static DungeonConnection mapLocalConnection(
            ResultSet rs,
            List<CubePoint> pathNodes,
            Set<Integer> stopLevels,
            long transitionId,
            long mapId
    ) throws SQLException {
        String placementType = rs.getString("placement_type");
        if (placementType == null || placementType.isBlank()) {
            return null;
        }
        return switch (placementType) {
            case "DOOR" -> {
                GridSegment2x boundarySegment2x = new GridSegment2x(
                            new GridPoint2x(rs.getInt("door_start_x2"), rs.getInt("door_start_y2")),
                            new GridPoint2x(rs.getInt("door_end_x2"), rs.getInt("door_end_y2")));
                ConnectionEndpoint sourceEndpoint = new ConnectionEndpoint(
                        ConnectionEndpointType.valueOf(rs.getString("door_endpoint_type")),
                        nullableLong(rs, "door_endpoint_id"));
                yield new DungeonConnection(
                        ConnectionKind.TRANSITION,
                        transitionId,
                        mapId,
                        rs.getInt("door_level_z"),
                        new DoorConnectionCarrier(
                                Door.fromSegments(List.of(boundarySegment2x), Door.DoorState.OPEN),
                                boundarySegment2x),
                        List.of(sourceEndpoint, ConnectionEndpoint.transition(transitionId)));
            }
            case "STAIR" -> new DungeonConnection(
                    ConnectionKind.TRANSITION,
                    transitionId,
                    mapId,
                    rs.getInt("stair_anchor_level_z"),
                    new StairConnectionCarrier(
                            new CellCoord(rs.getInt("stair_anchor_cell_x"), rs.getInt("stair_anchor_cell_y")),
                            rs.getInt("stair_anchor_level_z"),
                            StairShape.parse(rs.getString("stair_shape")),
                            CardinalDirection.fromCode(rs.getInt("stair_direction_code")),
                            rs.getInt("stair_min_level_z"),
                            rs.getInt("stair_max_level_z"),
                            rs.getInt("stair_dimension1"),
                            rs.getInt("stair_dimension2"),
                            DungeonStair.resolved(null, mapId, null, pathNodes, stopLevels)),
                    List.of(ConnectionEndpoint.transition(transitionId)));
            default -> throw new SQLException("Unbekannter dungeon transition placement_type: " + placementType);
        };
    }

    private static DungeonTransitionDestination mapDestination(ResultSet rs) throws SQLException {
        String destinationType = rs.getString("destination_type");
        return switch (destinationType) {
            case "DUNGEON_MAP" -> new DungeonTransitionDestination.DungeonMapDestination(
                    rs.getLong("target_dungeon_map_id"),
                    nullableLong(rs, "target_transition_id"));
            case "OVERWORLD_TILE" -> new DungeonTransitionDestination.OverworldTileDestination(
                    rs.getLong("target_overworld_map_id"),
                    rs.getLong("target_overworld_tile_id"));
            default -> throw new SQLException("Unbekannter dungeon transition destination_type: " + destinationType);
        };
    }

    private static void bindTransition(PreparedStatement ps, DungeonTransition transition, int startIndex) throws SQLException {
        if (transition == null) {
            throw new IllegalArgumentException("transition darf nicht null sein");
        }
        ps.setLong(startIndex, transition.mapId());
        ps.setString(startIndex + 1, transition.description());
        bindLocalConnection(ps, transition.localConnection(), startIndex + 2);
        DungeonTransitionDestination destination = transition.destination();
        ps.setString(startIndex + 19, destination == null ? "OVERWORLD_TILE" : destination.typeKey());
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            ps.setLong(startIndex + 20, overworld.mapId());
            ps.setLong(startIndex + 21, overworld.tileId());
            ps.setNull(startIndex + 22, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 23, java.sql.Types.INTEGER);
        } else if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            ps.setNull(startIndex + 20, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 21, java.sql.Types.INTEGER);
            ps.setLong(startIndex + 22, dungeon.mapId());
            if (dungeon.transitionId() == null) {
                ps.setNull(startIndex + 23, java.sql.Types.INTEGER);
            } else {
                ps.setLong(startIndex + 23, dungeon.transitionId());
            }
        } else {
            ps.setNull(startIndex + 20, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 21, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 22, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 23, java.sql.Types.INTEGER);
        }
        if (transition.linkedTransitionId() == null) {
            ps.setNull(startIndex + 24, java.sql.Types.INTEGER);
        } else {
            ps.setLong(startIndex + 24, transition.linkedTransitionId());
        }
    }

    private static void bindLocalConnection(PreparedStatement ps, DungeonConnection localConnection) throws SQLException {
        bindLocalConnection(ps, localConnection, 3);
    }

    private static void bindLocalConnection(
            PreparedStatement ps,
            DungeonConnection localConnection,
            int startIndex
    ) throws SQLException {
        if (localConnection != null && localConnection.doorCarrier() != null) {
            DoorConnectionCarrier doorCarrier = localConnection.doorCarrier();
            ConnectionEndpoint sourceEndpoint = localConnection.entryEndpoint();
            ps.setString(startIndex, "DOOR");
            ps.setInt(startIndex + 1, localConnection.levelZ());
            ps.setInt(startIndex + 2, doorCarrier.anchorSegment2x().start().x2());
            ps.setInt(startIndex + 3, doorCarrier.anchorSegment2x().start().y2());
            ps.setInt(startIndex + 4, doorCarrier.anchorSegment2x().end().x2());
            ps.setInt(startIndex + 5, doorCarrier.anchorSegment2x().end().y2());
            ps.setString(startIndex + 6, sourceEndpoint == null ? null : sourceEndpoint.type().name());
            if (sourceEndpoint == null || sourceEndpoint.id() == null) {
                ps.setNull(startIndex + 7, java.sql.Types.BIGINT);
            } else {
                ps.setLong(startIndex + 7, sourceEndpoint.id());
            }
            clearStairPlacement(ps, startIndex + 8);
            return;
        }
        if (localConnection != null && localConnection.stairCarrier() != null) {
            StairConnectionCarrier stairCarrier = localConnection.stairCarrier();
            ps.setString(startIndex, "STAIR");
            clearDoorPlacement(ps, startIndex + 1);
            ps.setInt(startIndex + 8, stairCarrier.anchorCell().x());
            ps.setInt(startIndex + 9, stairCarrier.anchorCell().y());
            ps.setInt(startIndex + 10, stairCarrier.anchorLevelZ());
            ps.setString(startIndex + 11, stairCarrier.shape().name());
            ps.setInt(startIndex + 12, stairCarrier.direction().code());
            ps.setInt(startIndex + 13, stairCarrier.dimension1());
            ps.setInt(startIndex + 14, stairCarrier.dimension2());
            ps.setInt(startIndex + 15, stairCarrier.minLevelZ());
            ps.setInt(startIndex + 16, stairCarrier.maxLevelZ());
            return;
        }
        ps.setNull(startIndex, java.sql.Types.VARCHAR);
        clearDoorPlacement(ps, startIndex + 1);
        clearStairPlacement(ps, startIndex + 8);
    }

    private static void clearDoorPlacement(PreparedStatement ps, int startIndex) throws SQLException {
        ps.setNull(startIndex, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 1, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 2, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 3, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 4, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 5, java.sql.Types.VARCHAR);
        ps.setNull(startIndex + 6, java.sql.Types.BIGINT);
    }

    private static void clearStairPlacement(PreparedStatement ps, int startIndex) throws SQLException {
        ps.setNull(startIndex, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 1, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 2, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 3, java.sql.Types.VARCHAR);
        ps.setNull(startIndex + 4, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 5, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 6, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 7, java.sql.Types.INTEGER);
        ps.setNull(startIndex + 8, java.sql.Types.INTEGER);
    }

    private static Map<Long, Set<Integer>> loadStopLevelsByTransitionId(Connection conn, long mapId) throws SQLException {
        Map<Long, Set<Integer>> mutable = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT transition_id, level_z"
                        + " FROM dungeon_transition_stair_stop_levels"
                        + " WHERE transition_id IN (SELECT transition_id FROM dungeon_transitions WHERE dungeon_map_id=?)"
                        + " ORDER BY transition_id, level_z")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    mutable.computeIfAbsent(rs.getLong("transition_id"), ignored -> new LinkedHashSet<>())
                            .add(rs.getInt("level_z"));
                }
            }
        }
        Map<Long, Set<Integer>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<Integer>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Set<Integer> loadStopLevels(Connection conn, long transitionId) throws SQLException {
        LinkedHashSet<Integer> result = new LinkedHashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT level_z FROM dungeon_transition_stair_stop_levels WHERE transition_id=? ORDER BY level_z")) {
            ps.setLong(1, transitionId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(rs.getInt("level_z"));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<CubePoint> loadPathNodes(Connection conn, long transitionId) throws SQLException {
        List<CubePoint> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cell_x, cell_y, cell_z FROM dungeon_transition_stair_path_nodes"
                        + " WHERE transition_id=? ORDER BY sort_order")) {
            ps.setLong(1, transitionId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new CubePoint(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("cell_z")));
                }
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static <K, V> Map<K, List<V>> loadGrouped(
            Connection conn,
            String sql,
            long mapId,
            ResultSetMapper<K> keyExtractor,
            ResultSetMapper<V> valueExtractor
    ) throws SQLException {
        Map<K, List<V>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    K key = keyExtractor.map(rs);
                    V value = valueExtractor.map(rs);
                    if (value != null) {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
                    } else {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>());
                    }
                }
            }
        }
        return result;
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }
}
