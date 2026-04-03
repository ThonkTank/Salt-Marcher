package features.world.dungeonmap.repository;

import database.DatabaseManager;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogRepository;
import features.world.dungeonmap.loading.DungeonMapLoadResult;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Repository-owned dungeon layout rehydration from direct persisted structure owners.
 *
 * <p>Catalog selection/fallback policy still lives here because the read side has to decide which persisted map is
 * structurally usable before the state layer can swap to it.
 */
public final class DungeonLayoutRepository {

    private final DungeonRoomRepository roomRepository = new DungeonRoomRepository();
    private final DungeonCorridorRepository corridorRepository = new DungeonCorridorRepository();
    private final DungeonStairRepository stairRepository = new DungeonStairRepository();
    private final DungeonTransitionRepository transitionRepository = new DungeonTransitionRepository();

    public DungeonMapLoadResult loadInitial() throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
            if (maps.isEmpty()) {
                return new DungeonMapLoadResult(List.of(), null, null);
            }
            LoadedCatalog loadedCatalog = loadUsableCatalog(conn, maps);
            if (loadedCatalog.usableMaps().isEmpty()) {
                return new DungeonMapLoadResult(List.of(), null, loadedCatalog.failureMessage());
            }
            DungeonMapCatalogEntry firstUsableMap = loadedCatalog.usableMaps().getFirst();
            return new DungeonMapLoadResult(
                    loadedCatalog.allMaps(),
                    loadedCatalog.layoutsById().get(firstUsableMap.mapId()),
                    loadedCatalog.failureMessage());
        }
    }

    public DungeonMapLoadResult selectMap(long mapId, List<DungeonMapCatalogEntry> fallbackMaps) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
            DungeonMapCatalogEntry requestedMap = findMap(maps, mapId);
            if (requestedMap == null) {
                return fallbackResult(
                        conn,
                        maps,
                        fallbackMaps,
                        Set.of(),
                        "Dungeon " + mapId + " existiert nicht mehr");
            }
            try {
                return new DungeonMapLoadResult(maps, loadLayoutOrThrow(conn, requestedMap), null);
            } catch (RuntimeException exception) {
                return fallbackResult(
                        conn,
                        maps,
                        fallbackMaps,
                        Set.of(requestedMap.mapId()),
                        combineMessages(
                                "Dungeon " + requestedMap.name() + " konnte nicht geladen werden",
                                requestedMap.name() + " (" + loadFailureMessage(exception) + ")"));
            }
        }
    }

    public DungeonLayout loadLayout(Connection conn, long mapId) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        DungeonStorageSupport.ensureCompatibility(conn);
        List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
        DungeonMapCatalogEntry map = findMap(maps, mapId);
        if (map == null) {
            return null;
        }
        try {
            return loadLayoutOrThrow(conn, map);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    public DungeonLayout loadFirstUsableLayout(Connection conn) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        DungeonStorageSupport.ensureCompatibility(conn);
        List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
        LoadedCatalog loadedCatalog = loadUsableCatalog(conn, maps);
        if (loadedCatalog.usableMaps().isEmpty()) {
            return null;
        }
        return loadedCatalog.layoutsById().get(loadedCatalog.usableMaps().getFirst().mapId());
    }

    private DungeonLayout loadLayoutOrThrow(Connection conn, DungeonMapCatalogEntry map) throws SQLException {
        List<Room> rooms = roomRepository.loadRooms(conn, map.mapId());
        List<RoomCluster> clusters = roomRepository.loadClusters(conn, map.mapId(), rooms);
        Map<Long, Integer> clusterLevels = roomRepository.loadClusterLevels(conn, map.mapId());
        List<Corridor> corridors = corridorRepository.loadByMap(conn, map.mapId(), rooms);
        List<DungeonStair> stairs = stairRepository.loadByMap(conn, map.mapId(), clusters, corridors);
        return new DungeonLayout(
                map.mapId(),
                map.name(),
                corridors,
                clusters,
                stairs,
                transitionRepository.loadByMap(conn, map.mapId()),
                clusterLevels);
    }

    private LoadedCatalog loadUsableCatalog(Connection conn, List<DungeonMapCatalogEntry> maps) throws SQLException {
        List<DungeonMapCatalogEntry> usableMaps = new ArrayList<>();
        Map<Long, DungeonLayout> layoutsById = new LinkedHashMap<>();
        Map<DungeonMapCatalogEntry, String> failuresByMap = new LinkedHashMap<>();
        for (DungeonMapCatalogEntry map : maps) {
            if (map == null) {
                continue;
            }
            try {
                DungeonLayout layout = loadLayoutOrThrow(conn, map);
                usableMaps.add(map);
                layoutsById.put(map.mapId(), layout);
            } catch (RuntimeException exception) {
                failuresByMap.put(map, loadFailureMessage(exception));
            }
        }
        return new LoadedCatalog(
                List.copyOf(maps),
                List.copyOf(usableMaps),
                Map.copyOf(layoutsById),
                Map.copyOf(failuresByMap));
    }

    private DungeonMapLoadResult fallbackResult(
            Connection conn,
            List<DungeonMapCatalogEntry> maps,
            List<DungeonMapCatalogEntry> fallbackMaps,
            Set<Long> excludedMapIds,
            String primaryMessage
    ) throws SQLException {
        String message = primaryMessage;
        for (DungeonMapCatalogEntry fallbackMap : fallbackCandidates(maps, fallbackMaps, excludedMapIds)) {
            try {
                return new DungeonMapLoadResult(maps, loadLayoutOrThrow(conn, fallbackMap), message);
            } catch (RuntimeException exception) {
                message = combineMessages(
                        message,
                        fallbackMap.name() + " (" + loadFailureMessage(exception) + ")");
            }
        }
        return new DungeonMapLoadResult(maps, null, message);
    }

    private static List<DungeonMapCatalogEntry> fallbackCandidates(
            List<DungeonMapCatalogEntry> maps,
            List<DungeonMapCatalogEntry> fallbackMaps,
            Set<Long> excludedMapIds
    ) {
        LinkedHashMap<Long, DungeonMapCatalogEntry> candidates = new LinkedHashMap<>();
        if (fallbackMaps != null) {
            for (DungeonMapCatalogEntry fallbackMap : fallbackMaps) {
                if (fallbackMap != null && !excludedMapIds.contains(fallbackMap.mapId())) {
                    candidates.putIfAbsent(fallbackMap.mapId(), fallbackMap);
                }
            }
        }
        for (DungeonMapCatalogEntry map : maps) {
            if (map != null && !excludedMapIds.contains(map.mapId())) {
                candidates.putIfAbsent(map.mapId(), map);
            }
        }
        return List.copyOf(candidates.values());
    }

    private static String combineMessages(String primaryMessage, String secondaryMessage) {
        if (primaryMessage == null || primaryMessage.isBlank()) {
            return secondaryMessage;
        }
        if (secondaryMessage == null || secondaryMessage.isBlank()) {
            return primaryMessage;
        }
        return primaryMessage + " " + secondaryMessage;
    }

    private static String loadFailureMessage(RuntimeException exception) {
        String message = exception.getMessage();
        if (message != null && !message.isBlank()) {
            return message;
        }
        return exception.getClass().getSimpleName();
    }

    private static DungeonMapCatalogEntry findMap(List<DungeonMapCatalogEntry> maps, long mapId) {
        for (DungeonMapCatalogEntry map : maps) {
            if (map.mapId() == mapId) {
                return map;
            }
        }
        return null;
    }

    private static final class LoadedCatalog {
        private final List<DungeonMapCatalogEntry> allMaps;
        private final List<DungeonMapCatalogEntry> usableMaps;
        private final Map<Long, DungeonLayout> layoutsById;
        private final Map<DungeonMapCatalogEntry, String> failuresByMap;

        private LoadedCatalog(
                List<DungeonMapCatalogEntry> allMaps,
                List<DungeonMapCatalogEntry> usableMaps,
                Map<Long, DungeonLayout> layoutsById,
                Map<DungeonMapCatalogEntry, String> failuresByMap
        ) {
            this.allMaps = allMaps == null ? List.of() : List.copyOf(allMaps);
            this.usableMaps = usableMaps == null ? List.of() : List.copyOf(usableMaps);
            this.layoutsById = layoutsById == null ? Map.of() : Map.copyOf(layoutsById);
            this.failuresByMap = failuresByMap == null ? Map.of() : Map.copyOf(failuresByMap);
        }

        private List<DungeonMapCatalogEntry> allMaps() {
            return allMaps;
        }

        private List<DungeonMapCatalogEntry> usableMaps() {
            return usableMaps;
        }

        private Map<Long, DungeonLayout> layoutsById() {
            return layoutsById;
        }

        private String failureMessage() {
            if (failuresByMap.isEmpty()) {
                return null;
            }
            List<Map.Entry<DungeonMapCatalogEntry, String>> failures = failuresByMap.entrySet().stream()
                    .sorted(Comparator.comparingLong(entry -> entry.getKey().mapId()))
                    .toList();
            Map.Entry<DungeonMapCatalogEntry, String> firstFailure = failures.getFirst();
            String prefix = failures.size() == 1
                    ? "1 Dungeon konnte nicht geladen werden"
                    : failures.size() + " Dungeons konnten nicht geladen werden";
            return prefix + ": " + firstFailure.getKey().name() + " (" + firstFailure.getValue() + ")";
        }
    }
}
