package features.world.dungeonmap.loading;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogRepository;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.repository.DungeonLayoutRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Owns synchronous dungeon-map selection policy so loading and runtime repair share one fallback order.
 */
public final class DungeonMapLoadResolver {

    private final DungeonLayoutRepository layoutRepository;

    public DungeonMapLoadResolver(DungeonLayoutRepository layoutRepository) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
    }

    public DungeonMapLoadResolution resolveInitial(Connection conn) throws SQLException {
        requireConnection(conn);
        List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
        if (maps.isEmpty()) {
            return new DungeonMapLoadResolution(List.of(), null, null);
        }
        LoadedCatalog loadedCatalog = loadUsableCatalog(conn, maps);
        if (loadedCatalog.usableMaps().isEmpty()) {
            return new DungeonMapLoadResolution(List.of(), null, loadedCatalog.failureMessage());
        }
        DungeonMapCatalogEntry firstUsableMap = loadedCatalog.usableMaps().getFirst();
        return new DungeonMapLoadResolution(
                loadedCatalog.allMaps(),
                loadedCatalog.layoutsById().get(firstUsableMap.mapId()),
                loadedCatalog.failureMessage());
    }

    public DungeonMapLoadResolution resolveSelection(
            Connection conn,
            long mapId,
            List<DungeonMapCatalogEntry> fallbackMaps
    ) throws SQLException {
        requireConnection(conn);
        List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
        DungeonMapCatalogEntry requestedMap = findMap(maps, mapId);
        if (requestedMap == null) {
            return fallbackResolution(
                    conn,
                    maps,
                    fallbackMaps,
                    Set.of(),
                    "Dungeon " + mapId + " existiert nicht mehr");
        }
        try {
            DungeonLayout layout = layoutRepository.loadLayout(conn, requestedMap.mapId());
            if (layout != null) {
                return new DungeonMapLoadResolution(maps, layout, null);
            }
            return fallbackResolution(
                    conn,
                    maps,
                    fallbackMaps,
                    Set.of(requestedMap.mapId()),
                    "Dungeon " + requestedMap.name() + " existiert nicht mehr");
        } catch (RuntimeException exception) {
            return fallbackResolution(
                    conn,
                    maps,
                    fallbackMaps,
                    Set.of(requestedMap.mapId()),
                    combineMessages(
                            "Dungeon " + requestedMap.name() + " konnte nicht geladen werden",
                            requestedMap.name() + " (" + loadFailureMessage(exception) + ")"));
        }
    }

    public DungeonLayout resolveRepairLayout(Connection conn, Long preferredMapId) throws SQLException {
        requireConnection(conn);
        List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
        DungeonMapCatalogEntry preferredMap = preferredMapId == null ? null : findMap(maps, preferredMapId);
        for (DungeonMapCatalogEntry candidate : candidateMaps(
                maps,
                preferredMap == null ? List.of() : List.of(preferredMap),
                Set.of())) {
            DungeonLayout layout = tryLoadLayout(conn, candidate);
            if (layout != null) {
                return layout;
            }
        }
        return null;
    }

    // Initial load is the only place that scans the full catalog for usable layouts so the UI can open the first
    // working dungeon while still surfacing broken-map warnings as one aggregated loading result.
    private LoadedCatalog loadUsableCatalog(Connection conn, List<DungeonMapCatalogEntry> maps) throws SQLException {
        List<DungeonMapCatalogEntry> usableMaps = new ArrayList<>();
        Map<Long, DungeonLayout> layoutsById = new LinkedHashMap<>();
        Map<DungeonMapCatalogEntry, String> failuresByMap = new LinkedHashMap<>();
        for (DungeonMapCatalogEntry map : maps) {
            if (map == null) {
                continue;
            }
            try {
                DungeonLayout layout = layoutRepository.loadLayout(conn, map.mapId());
                if (layout == null) {
                    failuresByMap.put(map, "Layout fehlt");
                    continue;
                }
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

    private DungeonMapLoadResolution fallbackResolution(
            Connection conn,
            List<DungeonMapCatalogEntry> maps,
            List<DungeonMapCatalogEntry> fallbackMaps,
            Set<Long> excludedMapIds,
            String primaryMessage
    ) throws SQLException {
        String message = primaryMessage;
        for (DungeonMapCatalogEntry fallbackMap : candidateMaps(maps, fallbackMaps, excludedMapIds)) {
            try {
                DungeonLayout layout = layoutRepository.loadLayout(conn, fallbackMap.mapId());
                if (layout != null) {
                    return new DungeonMapLoadResolution(maps, layout, message);
                }
                message = combineMessages(message, fallbackMap.name() + " (Layout fehlt)");
            } catch (RuntimeException exception) {
                message = combineMessages(
                        message,
                        fallbackMap.name() + " (" + loadFailureMessage(exception) + ")");
            }
        }
        return new DungeonMapLoadResolution(maps, null, message);
    }

    private DungeonLayout tryLoadLayout(Connection conn, DungeonMapCatalogEntry map) throws SQLException {
        if (map == null) {
            return null;
        }
        try {
            return layoutRepository.loadLayout(conn, map.mapId());
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private static List<DungeonMapCatalogEntry> candidateMaps(
            List<DungeonMapCatalogEntry> maps,
            List<DungeonMapCatalogEntry> preferredMaps,
            Set<Long> excludedMapIds
    ) {
        LinkedHashMap<Long, DungeonMapCatalogEntry> candidates = new LinkedHashMap<>();
        if (preferredMaps != null) {
            for (DungeonMapCatalogEntry preferredMap : preferredMaps) {
                if (preferredMap != null && !excludedMapIds.contains(preferredMap.mapId())) {
                    candidates.putIfAbsent(preferredMap.mapId(), preferredMap);
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

    private static void requireConnection(Connection conn) {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
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
