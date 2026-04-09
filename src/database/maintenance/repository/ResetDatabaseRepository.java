package database.maintenance.repository;

import database.DatabaseManager;
import database.maintenance.state.ResetDatabaseState;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

@SuppressWarnings("unused")
public final class ResetDatabaseRepository {

    private ResetDatabaseRepository() {
    }

    public static ResetDatabaseState resetDatabase(ResetDatabaseState state) throws SQLException, IOException {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        String target = normalizeTarget(state.target());
        String backupPath = state.backupBeforeReset() ? backupDatabase(state.backupPath(), target) : "";
        if (!"dungeon".equals(target)) {
            throw new IllegalArgumentException("Unsupported reset target: " + target);
        }
        try (Connection connection = DatabaseManager.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = OFF");
            for (String table : dungeonTables()) {
                statement.execute("DROP TABLE IF EXISTS " + table);
            }
            statement.execute("PRAGMA foreign_keys = ON");
        }
        return new ResetDatabaseState(target, state.backupBeforeReset(), backupPath, dungeonTables());
    }

    private static String normalizeTarget(String target) {
        return target == null || target.isBlank() ? "dungeon" : target.trim().toLowerCase();
    }

    private static String backupDatabase(String backupPath, String target) throws IOException {
        Path sourcePath = DatabaseManager.databasePath();
        if (!Files.exists(sourcePath)) {
            return "";
        }
        Path resolvedBackupPath = resolveBackupPath(backupPath, target);
        Files.createDirectories(resolvedBackupPath.getParent());
        Files.copy(sourcePath, resolvedBackupPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.COPY_ATTRIBUTES);
        return resolvedBackupPath.toString();
    }

    private static Path resolveBackupPath(String backupPath, String target) {
        if (backupPath != null && !backupPath.isBlank()) {
            return Path.of(backupPath).toAbsolutePath().normalize();
        }
        return Path.of("data", "backups", "db", "game-db-before-" + target + "-reset-" + timestamp() + ".sqlite")
                .toAbsolutePath()
                .normalize();
    }

    private static String timestamp() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmmss"));
    }

    private static List<String> dungeonTables() {
        return List.of(
                "dungeon_transitions",
                "dungeon_corridor_segments",
                "dungeon_corridor_nodes",
                "dungeon_corridor_endpoint_binding_targets",
                "dungeon_corridor_endpoint_bindings",
                "dungeon_corridor_points",
                "dungeon_corridor_connection_endpoints",
                "dungeon_corridor_connections",
                "dungeon_corridor_path_nodes",
                "dungeon_room_floors",
                "dungeon_room_cluster_edges",
                "dungeon_room_cluster_vertices",
                "dungeon_room_exit_descriptions",
                "dungeon_corridor_waypoints",
                "dungeon_corridor_door_overrides",
                "dungeon_corridor_members",
                "dungeon_corridors",
                "dungeon_rooms",
                "dungeon_room_clusters",
                "dungeon_stair_exits",
                "dungeon_stair_path_nodes",
                "dungeon_stairs",
                "dungeon_maps"
        );
    }
}
