package features.world.dungeonmap.infrastructure.campaignstate;

import features.campaignstate.api.CampaignDungeonLocationType;
import features.campaignstate.api.CampaignStateApi;
import features.campaignstate.api.CampaignStateReadApi;
import features.campaignstate.api.DungeonPositionRef;
import features.world.dungeonmap.domain.model.DungeonRuntimeLocation;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

public final class DungeonCampaignStateAdapter {

    private DungeonCampaignStateAdapter() {
        throw new AssertionError("No instances");
    }

    public static Optional<Long> getStoredMapId(Connection conn) throws SQLException {
        return CampaignStateReadApi.getDungeonMapId(conn);
    }

    public static DungeonRuntimeLocation getStoredActiveLocation(Connection conn, long mapId) throws SQLException {
        return CampaignStateReadApi.getDungeonPosition(conn)
                .filter(position -> position.mapId() != null && position.mapId() == mapId)
                .map(position -> {
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
                })
                .filter(location -> location != null)
                .orElse(null);
    }

    public static void clearActiveLocation(Connection conn) throws SQLException {
        CampaignStateApi.clearDungeonPosition(conn);
    }

    public static void updateActiveLocation(Connection conn, long mapId, DungeonRuntimeLocation location) throws SQLException {
        CampaignStateApi.setDungeonPosition(conn, toCampaignPosition(mapId, location));
    }

    private static DungeonPositionRef toCampaignPosition(long mapId, DungeonRuntimeLocation location) {
        if (location == null) {
            return new DungeonPositionRef(mapId, null, null, null, null);
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return new DungeonPositionRef(mapId, CampaignDungeonLocationType.CORRIDOR_COMPONENT, null, null, corridorComponent.componentId());
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            return new DungeonPositionRef(mapId, CampaignDungeonLocationType.CORRIDOR, null, corridor.corridorId(), null);
        }
        DungeonRuntimeLocation.Room room = (DungeonRuntimeLocation.Room) location;
        return new DungeonPositionRef(mapId, CampaignDungeonLocationType.ROOM, room.roomId(), null, null);
    }
}
