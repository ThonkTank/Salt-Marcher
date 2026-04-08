package features.world.dungeon.room.repository;

import features.world.dungeon.room.state.SaveNarrationExitState;
import features.world.dungeon.room.state.SaveNarrationState;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;

public final class SaveNarrationRepository {

    private SaveNarrationRepository() {
    }

    public static SaveNarrationState saveNarration(SaveNarrationState state) throws SQLException {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        try (Connection conn = openConnection()) {
            replaceVisualDescription(conn, state);
            replaceExitNarrations(conn, state);
        }
        return state;
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
            int sortOrder = 0;
            for (SaveNarrationExitState exit : state.exitNarrations()) {
                insert.setLong(1, state.roomId());
                insert.setInt(2, exit.levelZ());
                insert.setInt(3, exit.roomCellX());
                insert.setInt(4, exit.roomCellY());
                insert.setString(5, exit.direction());
                insert.setString(6, exit.description());
                insert.setInt(7, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static Connection openConnection() throws SQLException {
        prepareDatabasePath();
        ensureSqliteDriverLoaded();
        Connection conn = DriverManager.getConnection(databaseUrl());
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA foreign_keys = ON");
            stmt.execute("PRAGMA journal_mode = WAL");
        } catch (SQLException exception) {
            conn.close();
            throw exception;
        }
        return conn;
    }

    private static void prepareDatabasePath() throws SQLException {
        try {
            Files.createDirectories(databasePath().getParent());
        } catch (Exception exception) {
            throw new SQLException("Failed to prepare database path " + databasePath(), exception);
        }
    }

    private static void ensureSqliteDriverLoaded() throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException exception) {
            throw new SQLException("SQLite JDBC driver not found on the runtime classpath.", exception);
        }
    }

    private static String databaseUrl() {
        return "jdbc:sqlite:" + databasePath().toAbsolutePath();
    }

    private static Path databasePath() {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome != null && !xdgDataHome.isBlank()) {
            return Path.of(xdgDataHome, appDataDirName(), dbFileName()).toAbsolutePath().normalize();
        }
        return Path.of(System.getProperty("user.home"), ".local", "share", appDataDirName(), dbFileName())
                .toAbsolutePath()
                .normalize();
    }

    private static String appDataDirName() {
        return "salt-marcher";
    }

    private static String dbFileName() {
        return "game.db";
    }
}
