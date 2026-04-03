package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public final class DungeonTransitionRepository {

    private static final String SELECT_COLUMNS =
            "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y, level_z, destination_type,"
                    + " target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                    + " target_transition_id, linked_transition_id";

    public List<DungeonTransition> loadByMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                SELECT_COLUMNS + " FROM dungeon_transitions WHERE dungeon_map_id=? ORDER BY transition_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonTransition> result = new ArrayList<>();
                while (rs.next()) {
                    result.add(mapTransition(rs));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
        }
    }

    public List<DungeonTransition> loadPlacedByMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                SELECT_COLUMNS
                        + " FROM dungeon_transitions"
                        + " WHERE dungeon_map_id=? AND cell_x IS NOT NULL AND cell_y IS NOT NULL AND level_z IS NOT NULL"
                        + " ORDER BY transition_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonTransition> result = new ArrayList<>();
                while (rs.next()) {
                    result.add(mapTransition(rs));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
        }
    }

    public DungeonTransition find(Connection conn, long transitionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                SELECT_COLUMNS + " FROM dungeon_transitions WHERE transition_id=?")) {
            ps.setLong(1, transitionId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapTransition(rs) : null;
            }
        }
    }

    public long insert(Connection conn, DungeonTransition transition) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_transitions("
                        + "dungeon_map_id, description, cell_x, cell_y, level_z, destination_type,"
                        + "target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                        + "target_transition_id, linked_transition_id"
                        + ") VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            bindTransition(ps, transition);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No key returned for dungeon_transitions insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public void updatePlacement(Connection conn, long transitionId, CubePoint anchor) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_transitions SET cell_x=?, cell_y=?, level_z=? WHERE transition_id=?")) {
            if (anchor == null) {
                ps.setNull(1, java.sql.Types.INTEGER);
                ps.setNull(2, java.sql.Types.INTEGER);
                ps.setNull(3, java.sql.Types.INTEGER);
            } else {
                ps.setInt(1, anchor.x());
                ps.setInt(2, anchor.y());
                ps.setInt(3, anchor.z());
            }
            ps.setLong(4, transitionId);
            ps.executeUpdate();
        }
    }

    public void updateTargetTransition(Connection conn, long transitionId, Long targetTransitionId) throws SQLException {
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

    public void updateLinkedTransition(Connection conn, long transitionId, Long linkedTransitionId) throws SQLException {
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

    public void linkPair(Connection conn, long transitionId, long counterpartId) throws SQLException {
        updateTargetTransition(conn, transitionId, counterpartId);
        updateLinkedTransition(conn, transitionId, counterpartId);
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

    private static DungeonTransition mapTransition(ResultSet rs) throws SQLException {
        CubePoint anchor = rs.getObject("cell_x") == null
                ? null
                : new CubePoint(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("level_z"));
        return new DungeonTransition(
                rs.getLong("transition_id"),
                rs.getLong("dungeon_map_id"),
                rs.getString("description"),
                anchor,
                mapDestination(rs),
                nullableLong(rs, "linked_transition_id"));
    }

    private static DungeonTransitionDestination mapDestination(ResultSet rs) throws SQLException {
        String destinationType = rs.getString("destination_type");
        // Keep reading older rows that stored the nested record simple name before the canonical discriminator key.
        if (DungeonTransitionDestination.DungeonMapDestination.class.getSimpleName().equals(destinationType)) {
            destinationType = "DUNGEON_MAP";
        }
        if ("DUNGEON_MAP".equals(destinationType)) {
            return new DungeonTransitionDestination.DungeonMapDestination(
                    rs.getLong("target_dungeon_map_id"),
                    nullableLong(rs, "target_transition_id"));
        }
        return new DungeonTransitionDestination.OverworldTileDestination(
                rs.getLong("target_overworld_map_id"),
                rs.getLong("target_overworld_tile_id"));
    }

    private static void bindTransition(PreparedStatement ps, DungeonTransition transition) throws SQLException {
        if (transition == null) {
            throw new IllegalArgumentException("transition darf nicht null sein");
        }
        CubePoint anchor = transition.anchor();
        DungeonTransitionDestination destination = transition.destination();
        ps.setLong(1, transition.mapId());
        ps.setString(2, transition.description());
        if (anchor == null) {
            ps.setNull(3, java.sql.Types.INTEGER);
            ps.setNull(4, java.sql.Types.INTEGER);
            ps.setNull(5, java.sql.Types.INTEGER);
        } else {
            ps.setInt(3, anchor.x());
            ps.setInt(4, anchor.y());
            ps.setInt(5, anchor.z());
        }
        ps.setString(6, destination == null ? "OVERWORLD_TILE" : destination.typeKey());
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            ps.setLong(7, overworld.mapId());
            ps.setLong(8, overworld.tileId());
            ps.setNull(9, java.sql.Types.INTEGER);
            ps.setNull(10, java.sql.Types.INTEGER);
        } else if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            ps.setNull(7, java.sql.Types.INTEGER);
            ps.setNull(8, java.sql.Types.INTEGER);
            ps.setLong(9, dungeon.mapId());
            if (dungeon.transitionId() == null) {
                ps.setNull(10, java.sql.Types.INTEGER);
            } else {
                ps.setLong(10, dungeon.transitionId());
            }
        } else {
            ps.setNull(7, java.sql.Types.INTEGER);
            ps.setNull(8, java.sql.Types.INTEGER);
            ps.setNull(9, java.sql.Types.INTEGER);
            ps.setNull(10, java.sql.Types.INTEGER);
        }
        if (transition.linkedTransitionId() == null) {
            ps.setNull(11, java.sql.Types.INTEGER);
        } else {
            ps.setLong(11, transition.linkedTransitionId());
        }
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
