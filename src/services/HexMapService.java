package services;

import database.DatabaseManager;
import entities.HexMap;
import entities.HexTile;
import javafx.concurrent.Task;
import repositories.HexTileRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

/**
 * Thin service facade for map-related data access.
 * UI components access hex map data through this class, not directly via repositories.
 */
public class HexMapService {

    public static Optional<Long> getFirstMapId(Connection conn) {
        return HexTileRepository.getFirstMapId(conn);
    }

    public static List<HexTile> getTiles(Connection conn, long mapId) {
        return HexTileRepository.getTilesInMap(conn, mapId);
    }

    public static List<HexMap> getAllMaps(Connection conn) {
        return HexTileRepository.getAllMaps(conn);
    }

    public static void updateTerrainType(Connection conn, long tileId, String terrainType) {
        HexTileRepository.updateTerrainType(conn, tileId, terrainType);
    }

    /**
     * Loads tiles for the given map on a background thread and delivers them to the FX thread.
     * Consolidates the DB query into a single connection.
     */
    public static void loadMapAsync(long mapId, Consumer<List<HexTile>> onSuccess, Consumer<Throwable> onError) {
        Task<List<HexTile>> task = new Task<>() {
            @Override protected List<HexTile> call() throws Exception {
                try (Connection conn = DatabaseManager.getConnection()) {
                    return HexTileRepository.getTilesInMap(conn, mapId);
                }
            }
        };
        task.setOnSucceeded(e -> onSuccess.accept(task.getValue()));
        task.setOnFailed(e -> onError.accept(task.getException()));
        Thread t = new Thread(task, "sm-load-hex-map");
        t.setDaemon(true);
        t.start();
    }

    /**
     * Loads tiles for the first available map (single Task, single connection).
     */
    public static void loadFirstMapAsync(Consumer<List<HexTile>> onSuccess, Consumer<Throwable> onError) {
        Task<List<HexTile>> task = new Task<>() {
            @Override protected List<HexTile> call() throws Exception {
                try (Connection conn = DatabaseManager.getConnection()) {
                    Optional<Long> mapId = HexTileRepository.getFirstMapId(conn);
                    return mapId.map(id -> HexTileRepository.getTilesInMap(conn, id)).orElse(List.of());
                }
            }
        };
        task.setOnSucceeded(e -> onSuccess.accept(task.getValue()));
        task.setOnFailed(e -> onError.accept(task.getException()));
        Thread t = new Thread(task, "sm-load-hex-map");
        t.setDaemon(true);
        t.start();
    }

    /**
     * Creates a new hex map with a filled hexagonal grid of the given radius.
     * Radius 0 = single tile at (0,0). Radius N = all tiles with hex distance <= N from origin.
     * All tiles start as grassland.
     *
     * @return the new map's ID
     */
    public static long createHexMap(Connection conn, String name, int radius) throws SQLException {
        if (radius < 0 || radius > 50)
            throw new IllegalArgumentException("createHexMap: radius must be 0–50, got " + radius);

        HexMap map = new HexMap();
        map.Name = name;
        map.IsBounded = true;
        map.Radius = radius;
        long mapId = HexTileRepository.insertMap(conn, map);

        conn.setAutoCommit(false);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO hex_tiles(map_id, q, r, terrain_type, elevation, is_explored)"
                + " VALUES(?,?,?,'grassland',0,0)")) {
            for (int q = -radius; q <= radius; q++) {
                int rMin = Math.max(-radius, -q - radius);
                int rMax = Math.min(radius, -q + radius);
                for (int r = rMin; r <= rMax; r++) {
                    ps.setLong(1, mapId);
                    ps.setInt(2, q);
                    ps.setInt(3, r);
                    ps.addBatch();
                }
            }
            ps.executeBatch();
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }
        return mapId;
    }
}
