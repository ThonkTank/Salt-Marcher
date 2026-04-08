package features.world.dungeon.repository;

import features.world.dungeon.dungeonmap.api.DoorDescription;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.model.structures.connection.ConnectionEndpoint;
import features.world.dungeon.model.structures.connection.ConnectionKind;
import features.world.dungeon.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeon.model.structures.connection.DungeonConnection;
import features.world.dungeon.model.structures.connection.StairConnectionCarrier;
import features.world.dungeon.model.structures.stair.Stair;
import features.world.dungeon.model.structures.transition.DungeonTransition;
import features.world.dungeon.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeon.stair.model.StairPlacementSpec;
import features.world.dungeon.stair.model.StairPathPatternKind;
import features.world.dungeon.stair.model.StairPathPatternSpec;

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
import java.util.Objects;
import java.util.Set;

public final class DungeonTransitionRepository {

    private static final String SELECT_COLUMNS =
            "SELECT transition_id, dungeon_map_id, description, placement_type,"
                    + " door_id,"
                    + " stair_anchor_cell_x, stair_anchor_cell_y, stair_anchor_level_z, stair_shape_kind, stair_shape_direction_code,"
                    + " stair_shape_param1, stair_shape_param2, stair_min_level_z, stair_max_level_z,"
                    + " destination_type, target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                    + " target_transition_id, linked_transition_id";

    public List<DungeonTransition> loadByMap(Connection conn, DungeonMap layout) throws SQLException {
        DungeonMap resolvedLayout = Objects.requireNonNull(layout, "layout");
        long mapId = resolvedLayout.mapId();
        Map<Long, List<GridPoint>> pathByTransitionId = loadGrouped(
                conn,
                "SELECT transition_id, cell_x, cell_y, cell_z"
                        + " FROM dungeon_transition_stair_path_nodes"
                        + " WHERE transition_id IN (SELECT transition_id FROM dungeon_transitions WHERE dungeon_map_id=?)"
                        + " ORDER BY transition_id, sort_order",
                mapId,
                rs -> rs.getLong("transition_id"),
                rs -> GridPoint.cell(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("cell_z")));
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
                            resolvedLayout,
                            pathByTransitionId.getOrDefault(transitionId, List.of()),
                            stopLevelsByTransitionId.getOrDefault(transitionId, Set.of())));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
        }
    }

    public Long findMapId(Connection conn, long transitionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id FROM dungeon_transitions WHERE transition_id=?")) {
            ps.setLong(1, transitionId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong("dungeon_map_id") : null;
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
                            + "door_id,"
                            + "stair_anchor_cell_x, stair_anchor_cell_y, stair_anchor_level_z, stair_shape_kind, stair_shape_direction_code,"
                            + "stair_shape_param1, stair_shape_param2, stair_min_level_z, stair_max_level_z,"
                            + "destination_type, target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                            + "target_transition_id, linked_transition_id"
                            + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
                ps.setLong(1, transition.transitionId());
                bindTransition(ps, transition, 2);
                ps.executeUpdate();
                replaceCarrierDetails(conn, transition.transitionId(), transition.localConnection());
                return transition.transitionId();
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_transitions("
                        + "dungeon_map_id, description, placement_type,"
                        + "door_id,"
                        + "stair_anchor_cell_x, stair_anchor_cell_y, stair_anchor_level_z, stair_shape_kind, stair_shape_direction_code,"
                        + "stair_shape_param1, stair_shape_param2, stair_min_level_z, stair_max_level_z,"
                        + "destination_type, target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                        + "target_transition_id, linked_transition_id"
                        + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
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

    public void updateLocalConnection(
            Connection conn,
            long transitionId,
            DungeonConnection localConnection,
            StairPlacementSpec stairPlacementSpec
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_transitions SET "
                        + "placement_type=?,"
                        + "door_id=?,"
                        + "stair_anchor_cell_x=?, stair_anchor_cell_y=?, stair_anchor_level_z=?, stair_shape_kind=?, stair_shape_direction_code=?,"
                        + "stair_shape_param1=?, stair_shape_param2=?, stair_min_level_z=?, stair_max_level_z=? "
                        + "WHERE transition_id=?")) {
            bindLocalConnection(ps, localConnection, stairPlacementSpec, 1);
            ps.setLong(12, transitionId);
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
        replacePathNodes(conn, transitionId, stairCarrier == null ? GridPath.empty() : stairCarrier.stair().gridPath());
        replaceStopLevels(conn, transitionId, stairCarrier == null ? Set.of() : stairCarrier.stair().stopLevels());
    }

    private void replacePathNodes(Connection conn, long transitionId, GridPath path) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_transition_stair_path_nodes WHERE transition_id=?")) {
            delete.setLong(1, transitionId);
            delete.executeUpdate();
        }
        List<GridPoint> pathNodes = (path == null ? GridPath.empty() : path).points();
        if (pathNodes == null || pathNodes.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_transition_stair_path_nodes(transition_id, sort_order, cell_x, cell_y, cell_z)"
                        + " VALUES(?,?,?,?,?)")) {
            for (int index = 0; index < pathNodes.size(); index++) {
                GridPoint node = pathNodes.get(index);
                insert.setLong(1, transitionId);
                insert.setInt(2, index);
                insert.setInt(3, node.x2() / 2);
                insert.setInt(4, node.y2() / 2);
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
            DungeonMap layout,
            List<GridPoint> pathNodes,
            Set<Integer> stopLevels
    ) throws SQLException {
        long transitionId = rs.getLong("transition_id");
        long mapId = rs.getLong("dungeon_map_id");
        return new DungeonTransition(
                transitionId,
                mapId,
                rs.getString("description"),
                mapLocalConnection(rs, layout, pathNodes, stopLevels, transitionId, mapId),
                mapDestination(rs),
                nullableLong(rs, "linked_transition_id"),
                mapStairPlacementSpec(rs));
    }

    private static DungeonConnection mapLocalConnection(
            ResultSet rs,
            DungeonMap layout,
            List<GridPoint> pathNodes,
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
                Long doorId = nullableLong(rs, "door_id");
                if (doorId == null) {
                    throw new SQLException("Transition door placement is missing its canonical door reference");
                }
                DoorDescription description = layout == null ? null : layout.describeDoor(new DoorRef(doorId));
                if (description == null) {
                    throw new SQLException("Transition door placement references missing door " + doorId);
                }
                if (!description.supportsTransitionPlacement()) {
                    throw new SQLException("Transition door placement may not bind to a local room door");
                }
                ConnectionEndpoint sourceEndpoint = description.connectionEndpoint();
                yield new DungeonConnection(
                        ConnectionKind.TRANSITION,
                        transitionId,
                        mapId,
                        description.levelZ(),
                        new DoorConnectionCarrier(description.ref()),
                        List.of(sourceEndpoint, ConnectionEndpoint.transition(transitionId)));
            }
            case "STAIR" -> new DungeonConnection(
                    ConnectionKind.TRANSITION,
                    transitionId,
                    mapId,
                    rs.getInt("stair_anchor_level_z"),
                    new StairConnectionCarrier(
                            GridPoint.cell(rs.getInt("stair_anchor_cell_x"), rs.getInt("stair_anchor_cell_y"), 0),
                            rs.getInt("stair_anchor_level_z"),
                            Stair.of(GridPath.of(pathNodes), stopLevels)),
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
        bindLocalConnection(ps, transition.localConnection(), transition.stairPlacementSpec(), startIndex + 2);
        DungeonTransitionDestination destination = transition.destination();
        ps.setString(startIndex + 13, destination == null ? "OVERWORLD_TILE" : destination.typeKey());
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            ps.setLong(startIndex + 14, overworld.mapId());
            ps.setLong(startIndex + 15, overworld.tileId());
            ps.setNull(startIndex + 16, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 17, java.sql.Types.INTEGER);
        } else if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            ps.setNull(startIndex + 14, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 15, java.sql.Types.INTEGER);
            ps.setLong(startIndex + 16, dungeon.mapId());
            if (dungeon.transitionId() == null) {
                ps.setNull(startIndex + 17, java.sql.Types.INTEGER);
            } else {
                ps.setLong(startIndex + 17, dungeon.transitionId());
            }
        } else {
            ps.setNull(startIndex + 14, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 15, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 16, java.sql.Types.INTEGER);
            ps.setNull(startIndex + 17, java.sql.Types.INTEGER);
        }
        if (transition.linkedTransitionId() == null) {
            ps.setNull(startIndex + 18, java.sql.Types.INTEGER);
        } else {
            ps.setLong(startIndex + 18, transition.linkedTransitionId());
        }
    }

    private static void bindLocalConnection(
            PreparedStatement ps,
            DungeonConnection localConnection,
            StairPlacementSpec stairPlacementSpec,
            int startIndex
    ) throws SQLException {
        if (localConnection != null && localConnection.doorCarrier() != null) {
            DoorRef doorRef = localConnection.doorRef();
            if (doorRef == null) {
                throw new IllegalArgumentException("Door transition persistence requires a canonical door ref");
            }
            ps.setString(startIndex, "DOOR");
            ps.setLong(startIndex + 1, doorRef.doorId());
            clearStairPlacement(ps, startIndex + 2);
            return;
        }
        if (localConnection != null && localConnection.stairCarrier() != null) {
            StairConnectionCarrier stairCarrier = localConnection.stairCarrier();
            StairPlacementSpec placementSpec = stairPlacementSpec == null
                    ? new StairPlacementSpec(
                            stairCarrier.anchorCell(),
                            stairCarrier.anchorLevelZ(),
                            StairPathPatternSpec.defaultSpec(),
                            stairCarrier.anchorLevelZ(),
                            stairCarrier.anchorLevelZ(),
                            stairCarrier.stair().stopLevels())
                    : stairPlacementSpec;
            ps.setString(startIndex, "STAIR");
            clearDoorPlacement(ps, startIndex + 1);
            ps.setInt(startIndex + 2, placementSpec.anchorCell().x2() / 2);
            ps.setInt(startIndex + 3, placementSpec.anchorCell().y2() / 2);
            ps.setInt(startIndex + 4, placementSpec.anchorLevelZ());
            ps.setString(startIndex + 5, placementSpec.shapeSpec().kind().name());
            ps.setInt(startIndex + 6, placementSpec.shapeSpec().direction().code());
            ps.setInt(startIndex + 7, placementSpec.shapeSpec().parameter1());
            ps.setInt(startIndex + 8, placementSpec.shapeSpec().parameter2());
            ps.setInt(startIndex + 9, placementSpec.minLevelZ());
            ps.setInt(startIndex + 10, placementSpec.maxLevelZ());
            return;
        }
        ps.setNull(startIndex, java.sql.Types.VARCHAR);
        clearDoorPlacement(ps, startIndex + 1);
        clearStairPlacement(ps, startIndex + 2);
    }

    private static void clearDoorPlacement(PreparedStatement ps, int startIndex) throws SQLException {
        ps.setNull(startIndex, java.sql.Types.BIGINT);
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

    private static StairPlacementSpec mapStairPlacementSpec(ResultSet rs) throws SQLException {
        String placementType = rs.getString("placement_type");
        if (!"STAIR".equals(placementType)) {
            return null;
        }
        return new StairPlacementSpec(
                GridPoint.cell(rs.getInt("stair_anchor_cell_x"), rs.getInt("stair_anchor_cell_y"), 0),
                rs.getInt("stair_anchor_level_z"),
                new StairPathPatternSpec(
                        StairPathPatternKind.parse(rs.getString("stair_shape_kind")),
                        CardinalDirection.fromCode(rs.getInt("stair_shape_direction_code")),
                        rs.getInt("stair_shape_param1"),
                        rs.getInt("stair_shape_param2")),
                rs.getInt("stair_min_level_z"),
                rs.getInt("stair_max_level_z"),
                Set.of());
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

    private static List<GridPoint> loadPathNodes(Connection conn, long transitionId) throws SQLException {
        List<GridPoint> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cell_x, cell_y, cell_z FROM dungeon_transition_stair_path_nodes"
                        + " WHERE transition_id=? ORDER BY sort_order")) {
            ps.setLong(1, transitionId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(GridPoint.cell(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("cell_z")));
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
