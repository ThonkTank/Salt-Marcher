package features.world.dungeon.catalog;

import features.world.dungeon.catalog.application.DungeonMapCatalogService;
import features.world.dungeon.catalog.input.CreateMapInput;
import features.world.dungeon.catalog.input.DeleteMapInput;
import features.world.dungeon.catalog.input.RenameMapInput;

import java.sql.SQLException;
import java.util.Objects;

/**
 * Public root seam for dungeon-map catalog writes.
 */
public final class CatalogObject {

    private final DungeonMapCatalogService catalogService;

    public CatalogObject(DungeonMapCatalogService catalogService) {
        this.catalogService = Objects.requireNonNull(catalogService, "catalogService");
    }

    public long createMap(CreateMapInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return catalogService.createMap(input.name());
    }

    public void renameMap(RenameMapInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        catalogService.renameMap(input.mapId(), input.name());
    }

    public void deleteMap(DeleteMapInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        catalogService.deleteMap(input.mapId());
    }
}
