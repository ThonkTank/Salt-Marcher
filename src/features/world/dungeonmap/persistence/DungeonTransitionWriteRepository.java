package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public final class DungeonTransitionWriteRepository {

    public long insert(Connection conn, DungeonTransition transition) throws SQLException {
        DungeonTransitionSchemaSupport.ensureCompatibility(conn);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_transitions("
                        + "dungeon_map_id, name, cell_x, cell_y, level_z, destination_type,"
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
        DungeonTransitionSchemaSupport.ensureCompatibility(conn);
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
        DungeonTransitionSchemaSupport.ensureCompatibility(conn);
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
        DungeonTransitionSchemaSupport.ensureCompatibility(conn);
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
        DungeonTransitionSchemaSupport.ensureCompatibility(conn);
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

    public void delete(Connection conn, long transitionId) throws SQLException {
        DungeonTransitionSchemaSupport.ensureCompatibility(conn);
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_transitions WHERE transition_id=?")) {
            ps.setLong(1, transitionId);
            ps.executeUpdate();
        }
    }

    private static void bindTransition(PreparedStatement ps, DungeonTransition transition) throws SQLException {
        if (transition == null) {
            throw new IllegalArgumentException("transition darf nicht null sein");
        }
        CubePoint anchor = transition.anchor();
        DungeonTransitionDestination destination = transition.destination();
        ps.setLong(1, transition.mapId());
        ps.setString(2, transition.name());
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
}
