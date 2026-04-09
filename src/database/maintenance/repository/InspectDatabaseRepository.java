package database.maintenance.repository;

import database.DatabaseManager;
import database.maintenance.state.InspectDatabaseState;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

@SuppressWarnings("unused")
public final class InspectDatabaseRepository {

    private InspectDatabaseRepository() {
    }

    public static InspectDatabaseState inspectDatabase(InspectDatabaseState state) throws SQLException {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        Path databasePath = resolveDatabasePath(state.databasePath());
        if (!Files.exists(databasePath)) {
            return new InspectDatabaseState(
                    databasePath.toString(),
                    state.includeTableCounts(),
                    false,
                    0L,
                    List.of(),
                    List.of());
        }
        ensureSqliteDriverLoaded();
        ArrayList<String> tables = new ArrayList<>();
        ArrayList<String> tableCounts = new ArrayList<>();
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath.toAbsolutePath())) {
            loadTables(connection, tables);
            if (state.includeTableCounts()) {
                loadCounts(connection, tables, tableCounts);
            }
        }
        return new InspectDatabaseState(
                databasePath.toString(),
                state.includeTableCounts(),
                true,
                sizeOf(databasePath),
                tables,
                tableCounts);
    }

    private static void ensureSqliteDriverLoaded() throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException e) {
            throw new SQLException("SQLite JDBC driver not found on the runtime classpath.", e);
        }
    }

    private static Path resolveDatabasePath(String databasePath) {
        if (databasePath == null || databasePath.isBlank()) {
            return DatabaseManager.databasePath();
        }
        return Path.of(databasePath).toAbsolutePath().normalize();
    }

    private static long sizeOf(Path databasePath) {
        try {
            return Files.size(databasePath);
        } catch (Exception e) {
            return 0L;
        }
    }

    private static void loadTables(Connection connection, List<String> tables) throws SQLException {
        String sql = """
                select name
                from sqlite_master
                where type = 'table'
                  and name not like 'sqlite_%'
                order by name
                """;
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                tables.add(resultSet.getString(1));
            }
        }
    }

    private static void loadCounts(
            Connection connection,
            List<String> tables,
            List<String> tableCounts
    ) throws SQLException {
        for (String table : tables) {
            String sql = "select count(*) from \"" + table.replace("\"", "\"\"") + "\"";
            try (PreparedStatement statement = connection.prepareStatement(sql);
                 ResultSet resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    tableCounts.add(table + "\t" + resultSet.getLong(1));
                }
            }
        }
    }
}
