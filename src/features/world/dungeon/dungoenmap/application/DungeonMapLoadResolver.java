package features.world.dungeon.dungoenmap.application;

import features.world.dungeon.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeon.catalog.persistence.DungeonMapCatalogRepository;
import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.dungoenmap.repository.DungeonLayoutRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
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

    public LoadResolution resolveInitial(Connection conn) throws SQLException {
        requireConnection(conn);
        List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
        DungeonMap firstUsableLayout = null;
        int failedMapCount = 0;
        String firstFailureName = null;
        String firstFailureReason = null;
        for (DungeonMapCatalogEntry map : maps) {
            if (map == null) {
                continue;
            }
            try {
                DungeonMap layout = layoutRepository.loadLayout(conn, map);
                if (layout == null) {
                    failedMapCount++;
                    if (firstFailureName == null) {
                        firstFailureName = map.name();
                        firstFailureReason = "Layout fehlt";
                    }
                    continue;
                }
                if (firstUsableLayout == null) {
                    firstUsableLayout = layout;
                }
            } catch (RuntimeException exception) {
                failedMapCount++;
                if (firstFailureName == null) {
                    firstFailureName = map.name();
                    firstFailureReason = loadFailureMessage(exception);
                }
            }
        }
        return new LoadResolution(
                maps,
                firstUsableLayout,
                aggregatedFailureMessage(failedMapCount, firstFailureName, firstFailureReason));
    }

    public LoadResolution resolveSelection(
            Connection conn,
            long mapId,
            List<Long> preferredMapIds
    ) throws SQLException {
        requireConnection(conn);
        List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
        DungeonMapCatalogEntry requestedMap = findMap(maps, mapId);
        if (requestedMap == null) {
            return fallbackResolution(
                    conn,
                    maps,
                    preferredMapIds,
                    Set.of(),
                    "Dungeon " + mapId + " existiert nicht mehr");
        }
        try {
            DungeonMap layout = layoutRepository.loadLayout(conn, requestedMap);
            if (layout != null) {
                return new LoadResolution(maps, layout, null);
            }
            return fallbackResolution(
                    conn,
                    maps,
                    preferredMapIds,
                    Set.of(requestedMap.mapId()),
                    "Dungeon " + requestedMap.name() + " existiert nicht mehr");
        } catch (RuntimeException exception) {
            return fallbackResolution(
                    conn,
                    maps,
                    preferredMapIds,
                    Set.of(requestedMap.mapId()),
                    requestedLoadFailureMessage(requestedMap, exception));
        }
    }

    public DungeonMap resolveRepairLayout(Connection conn, Long preferredMapId) throws SQLException {
        requireConnection(conn);
        List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
        for (DungeonMapCatalogEntry candidate : candidateMaps(
                maps,
                preferredMapId == null ? List.of() : List.of(preferredMapId),
                Set.of())) {
            DungeonMap layout = tryLoadLayout(conn, candidate);
            if (layout != null) {
                return layout;
            }
        }
        return null;
    }

    private LoadResolution fallbackResolution(
            Connection conn,
            List<DungeonMapCatalogEntry> maps,
            List<Long> preferredMapIds,
            Set<Long> excludedMapIds,
            String primaryMessage
    ) throws SQLException {
        String message = primaryMessage;
        for (DungeonMapCatalogEntry fallbackMap : candidateMaps(maps, preferredMapIds, excludedMapIds)) {
            try {
                DungeonMap layout = layoutRepository.loadLayout(conn, fallbackMap);
                if (layout != null) {
                    return new LoadResolution(maps, layout, message);
                }
                message = combineMessages(message, fallbackMap.name() + " (Layout fehlt)");
            } catch (RuntimeException exception) {
                message = combineMessages(
                        message,
                        fallbackMap.name() + " (" + loadFailureMessage(exception) + ")");
            }
        }
        return new LoadResolution(maps, null, message);
    }

    private DungeonMap tryLoadLayout(Connection conn, DungeonMapCatalogEntry map) throws SQLException {
        if (map == null) {
            return null;
        }
        try {
            return layoutRepository.loadLayout(conn, map);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private static List<DungeonMapCatalogEntry> candidateMaps(
            List<DungeonMapCatalogEntry> maps,
            List<Long> preferredMapIds,
            Set<Long> excludedMapIds
    ) {
        LinkedHashMap<Long, DungeonMapCatalogEntry> mapsById = new LinkedHashMap<>();
        for (DungeonMapCatalogEntry map : maps) {
            if (map != null && !excludedMapIds.contains(map.mapId())) {
                mapsById.putIfAbsent(map.mapId(), map);
            }
        }
        LinkedHashMap<Long, DungeonMapCatalogEntry> candidates = new LinkedHashMap<>();
        if (preferredMapIds != null) {
            for (Long preferredMapId : preferredMapIds) {
                if (preferredMapId == null) {
                    continue;
                }
                DungeonMapCatalogEntry preferredMap = mapsById.get(preferredMapId);
                if (preferredMap != null) {
                    candidates.putIfAbsent(preferredMapId, preferredMap);
                }
            }
        }
        for (DungeonMapCatalogEntry map : mapsById.values()) {
            candidates.putIfAbsent(map.mapId(), map);
        }
        return List.copyOf(candidates.values());
    }

    private static String aggregatedFailureMessage(int failedMapCount, String firstFailureName, String firstFailureReason) {
        if (failedMapCount <= 0) {
            return null;
        }
        String prefix = failedMapCount == 1
                ? "1 Dungeon konnte nicht geladen werden"
                : failedMapCount + " Dungeons konnten nicht geladen werden";
        if (firstFailureName == null || firstFailureReason == null) {
            return prefix;
        }
        return prefix + ": " + firstFailureName + " (" + firstFailureReason + ")";
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

    private static String requestedLoadFailureMessage(DungeonMapCatalogEntry map, RuntimeException exception) {
        return "Dungeon " + map.name() + " konnte nicht geladen werden (" + loadFailureMessage(exception) + ")";
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

    record LoadResolution(
            List<DungeonMapCatalogEntry> maps,
            DungeonMap activeMap,
            String errorMessage
    ) {
        LoadResolution {
            maps = maps == null ? List.of() : List.copyOf(maps);
        }
    }
}
