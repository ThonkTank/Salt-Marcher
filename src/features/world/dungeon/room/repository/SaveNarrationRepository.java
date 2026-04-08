package features.world.dungeon.room.repository;

import database.DatabaseManager;
import features.world.dungeon.room.state.SaveNarrationExitState;
import features.world.dungeon.room.state.SaveNarrationState;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

@SuppressWarnings("unused")
public final class SaveNarrationRepository {

    private SaveNarrationRepository() {
    }

    public static SaveNarrationState saveNarration(SaveNarrationState state) throws SQLException {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
                replaceVisualDescription(conn, state);
                replaceExitNarrations(conn, state);
                return state;
            });
        }
    }

    private static void replaceVisualDescription(Connection conn, SaveNarrationState state) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET visual_description=? WHERE room_id=?")) {
            ps.setString(1, state.visualDescription());
            ps.setLong(2, state.roomId());
            ps.executeUpdate();
        }
    }

    private static void replaceExitNarrations(Connection conn, SaveNarrationState state) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_exit_descriptions WHERE room_id=?")) {
            delete.setLong(1, state.roomId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_exit_descriptions(room_id, level_z, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            for (int index = 0; index < state.exitNarrations().size(); index++) {
                SaveNarrationExitState exit = state.exitNarrations().get(index);
                insert.setLong(1, state.roomId());
                insert.setInt(2, exit.levelZ());
                insert.setInt(3, exit.roomCellX());
                insert.setInt(4, exit.roomCellY());
                insert.setString(5, exit.direction());
                insert.setString(6, exit.description());
                insert.setInt(7, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }
}
