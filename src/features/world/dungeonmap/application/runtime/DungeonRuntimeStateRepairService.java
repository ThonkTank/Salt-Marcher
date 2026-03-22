package features.world.dungeonmap.application.runtime;

import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.campaignstate.api.DungeonPositionRef;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogPersistence;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

public final class DungeonRuntimeStateRepairService {

    private final DungeonMapLoader mapLoader;

    public DungeonRuntimeStateRepairService(DungeonMapLoader mapLoader) {
        this.mapLoader = mapLoader;
    }

    public void repairStoredRuntimeState(Connection conn) throws SQLException {
        Optional<Long> preferredMapId = CampaignStateReadApi.getDungeonMapId(conn);
        DungeonLayout layout = preferredMapId.isPresent()
                ? mapLoader.loadLayout(conn, preferredMapId.orElseThrow())
                : null;
        if (layout == null) {
            Optional<Long> firstMapId = DungeonMapCatalogPersistence.firstMapId(conn);
            if (firstMapId.isEmpty()) {
                CampaignStateApi.clearDungeonPosition(conn);
                return;
            }
            layout = mapLoader.loadLayout(conn, firstMapId.orElseThrow());
        }
        if (layout == null) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        DungeonRuntimeLocation storedLocation = storedActiveLocation(conn, layout.mapId());
        DungeonRuntimeLocation resolvedLocation = resolveActiveLocation(layout, storedLocation);
        if (resolvedLocation == null) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        if (!resolvedLocation.equals(storedLocation)) {
            CampaignStateApi.setDungeonPosition(conn, toCampaignPosition(layout.mapId(), resolvedLocation));
        }
    }

    private static DungeonRuntimeLocation storedActiveLocation(Connection conn, long mapId) throws SQLException {
        return DungeonRuntimeLocations.storedActiveLocation(conn, mapId);
    }

    private static DungeonRuntimeLocation resolveActiveLocation(DungeonLayout layout, DungeonRuntimeLocation location) {
        return DungeonRuntimeLocations.resolveActiveLocation(layout, location);
    }

    private static DungeonPositionRef toCampaignPosition(long mapId, DungeonRuntimeLocation location) {
        return DungeonRuntimeLocations.toCampaignPosition(mapId, location);
    }
}
