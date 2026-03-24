package features.world.dungeonmap.application.runtime;

import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.campaignstate.api.DungeonPositionSummary;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogPersistence;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;

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
        long mapId = layout.mapId();
        Optional<DungeonPositionSummary> storedPosition = CampaignStateReadApi.getDungeonPosition(conn)
                .filter(position -> position.mapId() != null && position.mapId() == mapId);
        DungeonRuntimeLocation storedLocation = storedPosition
                .map(DungeonRuntimeLocations::toRuntimeLocation)
                .orElse(null);
        CardinalDirection storedHeading = CardinalDirection.parse(storedPosition
                .map(DungeonPositionSummary::heading)
                .orElse(null));
        DungeonRuntimeLocation resolvedLocation = DungeonRuntimeLocations.resolveActiveLocation(layout, storedLocation);
        if (resolvedLocation == null) {
            CampaignStateApi.clearDungeonPosition(conn);
            return;
        }
        if (!resolvedLocation.equals(storedLocation)) {
            CampaignStateApi.setDungeonPosition(conn, DungeonRuntimeLocations.toCampaignPosition(mapId, resolvedLocation, storedHeading));
        }
    }
}
