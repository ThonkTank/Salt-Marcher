package features.world.dungeonmap.application.runtime;

import features.campaignstate.api.CampaignDungeonLocationType;
import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.campaignstate.api.DungeonPositionRef;
import features.campaignstate.api.DungeonPositionSummary;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogPersistence;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Comparator;
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
        return CampaignStateReadApi.getDungeonPosition(conn)
                .filter(position -> position.mapId() != null && position.mapId() == mapId)
                .map(DungeonRuntimeStateRepairService::toRuntimeLocation)
                .orElse(null);
    }

    private static DungeonRuntimeLocation toRuntimeLocation(DungeonPositionSummary position) {
        if (position == null) {
            return null;
        }
        if (position.locationType() == CampaignDungeonLocationType.CORRIDOR_COMPONENT && position.locationKey() != null) {
            return DungeonRuntimeLocation.corridorComponent(position.locationKey());
        }
        if (position.locationType() == CampaignDungeonLocationType.CORRIDOR && position.corridorId() != null) {
            return DungeonRuntimeLocation.corridor(position.corridorId());
        }
        if (position.roomId() != null) {
            return DungeonRuntimeLocation.room(position.roomId());
        }
        return null;
    }

    private static DungeonRuntimeLocation resolveActiveLocation(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            CorridorNetwork network = layout.corridorNetworkForCorridor(corridor.corridorId());
            if (network != null) {
                location = DungeonRuntimeLocation.corridorComponent(network.networkId());
            }
        }
        if (containsLocation(layout, location)) {
            return location;
        }
        Long roomId = layout.rooms().stream()
                .map(room -> room.roomId())
                .filter(id -> id != null)
                .min(Comparator.naturalOrder())
                .orElse(null);
        return roomId == null ? null : DungeonRuntimeLocation.room(roomId);
    }

    private static boolean containsLocation(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (layout == null || location == null) {
            return false;
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent component) {
            return layout.corridorNetworks().stream()
                    .map(CorridorNetwork::networkId)
                    .anyMatch(component.componentId()::equals);
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            return layout.findCorridor(corridor.corridorId()) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Room room) {
            return layout.findRoom(room.roomId()) != null;
        }
        return false;
    }

    private static DungeonPositionRef toCampaignPosition(long mapId, DungeonRuntimeLocation location) {
        if (location instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return new DungeonPositionRef(mapId, CampaignDungeonLocationType.CORRIDOR_COMPONENT, null, null, corridorComponent.componentId());
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            return new DungeonPositionRef(mapId, CampaignDungeonLocationType.CORRIDOR, null, corridor.corridorId(), null);
        }
        if (location instanceof DungeonRuntimeLocation.Room room) {
            return new DungeonPositionRef(mapId, CampaignDungeonLocationType.ROOM, room.roomId(), null, null);
        }
        return new DungeonPositionRef(mapId, null, null, null, null);
    }
}
