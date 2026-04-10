package features.world.dungeon.dungeonmap.application;

import features.world.dungeon.catalog.CatalogObject;
import features.world.dungeon.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeon.catalog.input.LoadMapListInput;
import features.world.dungeon.catalog.input.ResolveSelectionInput;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.repository.DungeonMapRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Owns synchronous dungeon-map loading over catalog-owned map lists and selection policy.
 */
@SuppressWarnings("unused")
public final class DungeonMapLoadResolver {

    private final DungeonMapRepository mapRepository;
    private final CatalogObject catalogObject;

    public DungeonMapLoadResolver(DungeonMapRepository mapRepository) {
        this(mapRepository, new CatalogObject());
    }

    public DungeonMapLoadResolver(
            DungeonMapRepository mapRepository,
            CatalogObject catalogObject
    ) {
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.catalogObject = Objects.requireNonNull(catalogObject, "catalogObject");
    }

    public LoadResolution resolveInitial(Connection conn) throws SQLException {
        requireConnection(conn);
        LoadMapListInput.LoadedMapListInput mapList = catalogObject.loadMapList(new LoadMapListInput(conn));
        ResolveSelectionInput.ResolvedSelectionInput selection = catalogObject.resolveSelection(
                new ResolveSelectionInput(mapList.maps(), null, List.of(), Set.of()));
        DungeonMap firstUsableLayout = null;
        int failedMapCount = 0;
        String firstFailureDetail = null;
        for (DungeonMapCatalogEntry map : selection.candidateMaps()) {
            if (map == null) {
                continue;
            }
            try {
                DungeonMap layout = mapRepository.loadMap(conn, map);
                if (layout == null) {
                    failedMapCount++;
                    if (firstFailureDetail == null) {
                        firstFailureDetail = map.name() + " (Layout fehlt)";
                    }
                    continue;
                }
                if (firstUsableLayout == null) {
                    firstUsableLayout = layout;
                }
            } catch (RuntimeException exception) {
                failedMapCount++;
                if (firstFailureDetail == null) {
                    firstFailureDetail = map.name() + " (" + loadFailureMessage(exception) + ")";
                }
            }
        }
        return new LoadResolution(
                mapList.maps(),
                firstUsableLayout,
                aggregatedFailureMessage(failedMapCount, firstFailureDetail));
    }

    public LoadResolution resolveSelection(
            Connection conn,
            long mapId,
            List<Long> preferredMapIds
    ) throws SQLException {
        requireConnection(conn);
        LoadMapListInput.LoadedMapListInput mapList = catalogObject.loadMapList(new LoadMapListInput(conn));
        ResolveSelectionInput.ResolvedSelectionInput selection = catalogObject.resolveSelection(
                new ResolveSelectionInput(mapList.maps(), mapId, preferredMapIds, Set.of()));
        DungeonMapCatalogEntry requestedMap = selection.requestedMap();
        if (requestedMap == null) {
            return fallbackResolution(
                    conn,
                    mapList.maps(),
                    selection.candidateMaps(),
                    "Dungeon " + mapId + " existiert nicht mehr");
        }
        try {
            DungeonMap layout = mapRepository.loadMap(conn, requestedMap);
            if (layout != null) {
                return new LoadResolution(mapList.maps(), layout, null);
            }
            return fallbackResolution(
                    conn,
                    mapList.maps(),
                    selection.candidateMaps(),
                    "Dungeon " + requestedMap.name() + " existiert nicht mehr");
        } catch (RuntimeException exception) {
            return fallbackResolution(
                    conn,
                    mapList.maps(),
                    selection.candidateMaps(),
                    requestedLoadFailureMessage(requestedMap, exception));
        }
    }

    public DungeonMap resolveRepairLayout(Connection conn, Long preferredMapId) throws SQLException {
        requireConnection(conn);
        LoadMapListInput.LoadedMapListInput mapList = catalogObject.loadMapList(new LoadMapListInput(conn));
        ResolveSelectionInput.ResolvedSelectionInput selection = catalogObject.resolveSelection(
                new ResolveSelectionInput(
                        mapList.maps(),
                        null,
                        preferredMapId == null ? List.of() : List.of(preferredMapId),
                        Set.of()));
        for (DungeonMapCatalogEntry candidate : selection.candidateMaps()) {
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
            List<DungeonMapCatalogEntry> fallbackMaps,
            String primaryMessage
    ) throws SQLException {
        String message = primaryMessage;
        for (DungeonMapCatalogEntry fallbackMap : fallbackMaps) {
            try {
                DungeonMap layout = mapRepository.loadMap(conn, fallbackMap);
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
            return mapRepository.loadMap(conn, map);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private static String aggregatedFailureMessage(int failedMapCount, String firstFailureDetail) {
        if (failedMapCount <= 0) {
            return null;
        }
        String prefix = failedMapCount == 1
                ? "1 Dungeon konnte nicht geladen werden"
                : failedMapCount + " Dungeons konnten nicht geladen werden";
        if (firstFailureDetail == null || firstFailureDetail.isBlank()) {
            return prefix;
        }
        return prefix + ": " + firstFailureDetail;
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
