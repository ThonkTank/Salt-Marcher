package features.world.dungeon.catalog;

import features.world.dungeon.catalog.application.DungeonMapCatalogService;
import features.world.dungeon.catalog.input.CreateMapInput;
import features.world.dungeon.catalog.input.DeleteMapInput;
import features.world.dungeon.catalog.input.LoadMapListInput;
import features.world.dungeon.catalog.input.RenameMapInput;
import features.world.dungeon.catalog.input.ResolveSelectionInput;
import features.world.dungeon.catalog.persistence.DungeonMapCatalogRepository;

import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Public root seam for dungeon-map catalog writes, list loading, and map-selection policy.
 */
@SuppressWarnings("unused")
public final class CatalogObject {

    private final DungeonMapCatalogService catalogService;

    public CatalogObject() {
        this.catalogService = null;
    }

    public CatalogObject(DungeonMapCatalogService catalogService) {
        this.catalogService = Objects.requireNonNull(catalogService, "catalogService");
    }

    public LoadMapListInput.LoadedMapListInput loadMapList(LoadMapListInput input) throws SQLException {
        if (input == null || input.connection() == null) {
            throw new IllegalArgumentException("input");
        }
        return new LoadMapListInput.LoadedMapListInput(DungeonMapCatalogRepository.listMaps(input.connection()));
    }

    public ResolveSelectionInput.ResolvedSelectionInput resolveSelection(ResolveSelectionInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        List<features.world.dungeon.catalog.application.DungeonMapCatalogEntry> maps = input.maps();
        Long requestedMapId = input.requestedMapId();
        features.world.dungeon.catalog.application.DungeonMapCatalogEntry requestedMap =
                requestedMapId == null ? null : findMap(maps, requestedMapId);
        Set<Long> excludedMapIds = requestedMapId == null
                ? input.excludedMapIds()
                : mergeExcluded(input.excludedMapIds(), requestedMapId);
        return new ResolveSelectionInput.ResolvedSelectionInput(
                maps,
                requestedMap,
                candidateMaps(maps, input.preferredMapIds(), excludedMapIds));
    }

    public long createMap(CreateMapInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return requireCatalogService().createMap(input.name());
    }

    public void renameMap(RenameMapInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        requireCatalogService().renameMap(input.mapId(), input.name());
    }

    public void deleteMap(DeleteMapInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        requireCatalogService().deleteMap(input.mapId());
    }

    private DungeonMapCatalogService requireCatalogService() {
        if (catalogService == null) {
            throw new IllegalStateException("CatalogObject write operations require DungeonMapCatalogService");
        }
        return catalogService;
    }

    private static List<features.world.dungeon.catalog.application.DungeonMapCatalogEntry> candidateMaps(
            List<features.world.dungeon.catalog.application.DungeonMapCatalogEntry> maps,
            List<Long> preferredMapIds,
            Set<Long> excludedMapIds
    ) {
        LinkedHashMap<Long, features.world.dungeon.catalog.application.DungeonMapCatalogEntry> mapsById = new LinkedHashMap<>();
        for (features.world.dungeon.catalog.application.DungeonMapCatalogEntry map : maps) {
            if (map != null && !excludedMapIds.contains(map.mapId())) {
                mapsById.putIfAbsent(map.mapId(), map);
            }
        }
        LinkedHashMap<Long, features.world.dungeon.catalog.application.DungeonMapCatalogEntry> candidates = new LinkedHashMap<>();
        if (preferredMapIds != null) {
            for (Long preferredMapId : preferredMapIds) {
                if (preferredMapId == null) {
                    continue;
                }
                features.world.dungeon.catalog.application.DungeonMapCatalogEntry preferredMap = mapsById.get(preferredMapId);
                if (preferredMap != null) {
                    candidates.putIfAbsent(preferredMapId, preferredMap);
                }
            }
        }
        for (features.world.dungeon.catalog.application.DungeonMapCatalogEntry map : mapsById.values()) {
            candidates.putIfAbsent(map.mapId(), map);
        }
        return List.copyOf(candidates.values());
    }

    private static features.world.dungeon.catalog.application.DungeonMapCatalogEntry findMap(
            List<features.world.dungeon.catalog.application.DungeonMapCatalogEntry> maps,
            long mapId
    ) {
        for (features.world.dungeon.catalog.application.DungeonMapCatalogEntry map : maps) {
            if (map != null && map.mapId() == mapId) {
                return map;
            }
        }
        return null;
    }

    private static Set<Long> mergeExcluded(Set<Long> excludedMapIds, long requestedMapId) {
        if (excludedMapIds == null || excludedMapIds.isEmpty()) {
            return Set.of(requestedMapId);
        }
        java.util.LinkedHashSet<Long> merged = new java.util.LinkedHashSet<>(excludedMapIds);
        merged.add(requestedMapId);
        return Set.copyOf(merged);
    }
}
