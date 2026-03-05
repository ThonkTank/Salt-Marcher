package services;

import database.DatabaseManager;
import entities.HexMap;
import entities.HexTile;
import javafx.concurrent.Task;
import repositories.CampaignStateRepository;
import repositories.HexTileRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

/**
 * Thin service facade for map-related data access.
 * UI components access hex map data through this class, not directly via repositories.
 */
public class HexMapService {

    private record MapLoadResult(List<HexTile> tiles, Long partyTileId) {}

    private static final AtomicLong pendingPartyTileId = new AtomicLong(-1);
    private static final ScheduledExecutorService partySaveExecutor =
        Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "sm-save-party-pos");
            t.setDaemon(true);
            return t;
        });
    private static ScheduledFuture<?> pendingSave;

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
     * Loads tiles for the first available map together with the party tile ID from campaign state.
     * Delivers (tiles, partyTileId) on the FX thread; partyTileId may be null.
     */
    public static void loadFirstMapWithPartyAsync(BiConsumer<List<HexTile>, Long> onSuccess, Consumer<Throwable> onError) {
        Task<MapLoadResult> task = new Task<>() {
            @Override protected MapLoadResult call() throws Exception {
                try (Connection conn = DatabaseManager.getConnection()) {
                    Optional<Long> mapId = HexTileRepository.getFirstMapId(conn);
                    if (mapId.isEmpty()) return new MapLoadResult(List.of(), null);
                    Long partyTileId = CampaignStateRepository.get(conn)
                            .map(s -> s.PartyTileId).orElse(null);
                    List<HexTile> tiles = HexTileRepository.getTilesInMap(conn, mapId.get());
                    return new MapLoadResult(tiles, partyTileId);
                }
            }
        };
        task.setOnSucceeded(e -> {
            MapLoadResult result = task.getValue();
            onSuccess.accept(result.tiles(), result.partyTileId());
        });
        task.setOnFailed(e -> onError.accept(task.getException()));
        Thread t = new Thread(task, "sm-load-hex-map-with-party");
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
        Thread t = new Thread(task, "sm-load-first-map");
        t.setDaemon(true);
        t.start();
    }

    /**
     * Updates map name and radius atomically. If radius changed, grows or shrinks the tile grid.
     */
    public static void updateMap(Connection conn, long mapId, String newName, int oldRadius, int newRadius) throws SQLException {
        if (newRadius < 0 || newRadius > 50)
            throw new IllegalArgumentException("updateMap: radius must be 0–50, got " + newRadius);

        conn.setAutoCommit(false);
        try {
            HexTileRepository.updateMap(conn, mapId, newName, newRadius);

            if (newRadius > oldRadius) {
                HexTileRepository.insertTilesForRadius(conn, mapId, newRadius);
            } else if (newRadius < oldRadius) {
                HexTileRepository.clearPartyTileOutsideRadius(conn, mapId, newRadius);
                HexTileRepository.deleteTilesOutsideRadius(conn, mapId, newRadius);
            }

            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }
    }

    /** Persists the party's current tile position in campaign_state (debounced, 300ms). */
    public static void updatePartyTileAsync(long tileId) {
        pendingPartyTileId.set(tileId);
        if (pendingSave != null) pendingSave.cancel(false);
        pendingSave = partySaveExecutor.schedule(() -> {
            long id = pendingPartyTileId.get();
            try (Connection conn = DatabaseManager.getConnection()) {
                CampaignStateRepository.updatePartyTile(conn, id);
            } catch (Exception e) {
                System.err.println("HexMapService.updatePartyTileAsync(): " + e.getMessage());
            }
        }, 300, TimeUnit.MILLISECONDS);
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

    /** Returns the number of tiles in a filled hex grid of the given radius. */
    public static int hexTileCount(int radius) {
        return 3 * radius * (radius + 1) + 1;
    }
}
