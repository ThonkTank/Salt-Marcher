package clean.world.mapcatalog.repository;

import clean.world.mapcatalog.input.LoadMapsInput;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Stateless clean-local world map persistence boundary.
 */
public final class MapcatalogRepository {
    private MapcatalogRepository() {
        throw new AssertionError("No instances");
    }

    public static List<LoadMapsInput.MapSummary> loadMaps() throws SQLException {
        List<LoadMapsInput.MapSummary> maps = new ArrayList<>();
        try (Connection connection = openConnection()) {
            maps.addAll(loadHexMaps(connection));
            maps.addAll(loadDungeonMaps(connection));
        }
        return List.copyOf(maps);
    }

    private static List<LoadMapsInput.MapSummary> loadHexMaps(Connection connection) throws SQLException {
        List<LoadMapsInput.MapSummary> maps = new ArrayList<>();
        String sql = "SELECT map_id, name, radius FROM hex_maps ORDER BY LOWER(name), map_id";
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                long mapId = resultSet.getLong("map_id");
                String title = fallbackTitle(resultSet.getString("name"), "Hexmap #" + mapId);
                int radius = resultSet.getInt("radius");
                maps.add(new LoadMapsInput.MapSummary(
                        new LoadMapsInput.MapRef(new LoadMapsInput.HexmapKind(), mapId),
                        title,
                        "Hexmap mit Radius " + radius + "."
                ));
            }
        }
        return maps;
    }

    private static List<LoadMapsInput.MapSummary> loadDungeonMaps(Connection connection) throws SQLException {
        List<LoadMapsInput.MapSummary> maps = new ArrayList<>();
        String sql = "SELECT dungeon_map_id, name FROM dungeon_maps ORDER BY LOWER(name), dungeon_map_id";
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                long mapId = resultSet.getLong("dungeon_map_id");
                String title = fallbackTitle(resultSet.getString("name"), "Dungeon #" + mapId);
                maps.add(new LoadMapsInput.MapSummary(
                        new LoadMapsInput.MapRef(new LoadMapsInput.DungeonKind(), mapId),
                        title,
                        "Dungeon-Karte fuer Runtime und Editor."
                ));
            }
        }
        return maps;
    }

    private static Connection openConnection() throws SQLException {
        Path databasePath = resolveDatabasePath();
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
            statement.execute("PRAGMA journal_mode=WAL");
        }
        return connection;
    }

    private static Path resolveDatabasePath() {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome != null && !xdgDataHome.isBlank()) {
            return Path.of(xdgDataHome, "salt-marcher", "game.db");
        }
        return Path.of(System.getProperty("user.home"), ".local", "share", "salt-marcher", "game.db");
    }

    private static String fallbackTitle(String value, String fallback) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isEmpty() ? fallback : normalized;
    }
}
