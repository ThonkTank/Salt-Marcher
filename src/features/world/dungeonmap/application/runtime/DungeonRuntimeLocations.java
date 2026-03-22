package features.world.dungeonmap.application.runtime;

import features.campaignstate.api.CampaignDungeonLocationType;
import features.campaignstate.api.DungeonPositionRef;
import features.campaignstate.api.DungeonPositionSummary;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;

final class DungeonRuntimeLocations {

    private static final String TILE_PREFIX = "tile:";

    private DungeonRuntimeLocations() {
    }

    static DungeonRuntimeLocation toRuntimeLocation(DungeonPositionSummary position) {
        if (position == null) {
            return null;
        }
        if (position.locationType() == CampaignDungeonLocationType.TILE && position.locationKey() != null) {
            Point2i tile = parseTile(position.locationKey());
            return tile == null ? null : DungeonRuntimeLocation.tile(tile);
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

    static DungeonRuntimeLocation resolveActiveLocation(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (layout == null) {
            return null;
        }
        Point2i resolvedTile = null;
        if (location instanceof DungeonRuntimeLocation.Tile tileLocation) {
            resolvedTile = layout.isTraversableCell(tileLocation.tile()) ? tileLocation.tile() : null;
        } else if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            resolvedTile = roomAnchor(layout, roomLocation.roomId());
        } else if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            resolvedTile = corridorAnchor(layout.findCorridor(corridorLocation.corridorId()));
        } else if (location instanceof DungeonRuntimeLocation.CorridorComponent componentLocation) {
            resolvedTile = corridorNetworkAnchor(layout, componentLocation.componentId());
        }
        if (resolvedTile != null) {
            return DungeonRuntimeLocation.tile(resolvedTile);
        }
        Point2i fallbackTile = layout.rooms().stream()
                .sorted(java.util.Comparator.comparing(room -> room.roomId() == null ? Long.MAX_VALUE : room.roomId()))
                .map(room -> roomAnchor(layout, room.roomId()))
                .filter(tile -> tile != null)
                .findFirst()
                .orElse(null);
        return fallbackTile == null ? null : DungeonRuntimeLocation.tile(fallbackTile);
    }

    static boolean containsLocation(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (layout == null || location == null) {
            return false;
        }
        if (location instanceof DungeonRuntimeLocation.Tile tile) {
            return layout.isTraversableCell(tile.tile());
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent component) {
            return layout.findCorridorNetwork(component.componentId()) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            return layout.findCorridor(corridor.corridorId()) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Room room) {
            return layout.findRoom(room.roomId()) != null;
        }
        return false;
    }

    static DungeonPositionRef toCampaignPosition(long mapId, DungeonRuntimeLocation location, DungeonHeading heading) {
        String headingValue = (heading == null ? DungeonHeading.defaultHeading() : heading).name();
        if (location instanceof DungeonRuntimeLocation.Tile tile) {
            return new DungeonPositionRef(mapId, CampaignDungeonLocationType.TILE, null, null, formatTile(tile.tile()), headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return new DungeonPositionRef(mapId, CampaignDungeonLocationType.CORRIDOR_COMPONENT, null, null, corridorComponent.componentId(), headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            return new DungeonPositionRef(mapId, CampaignDungeonLocationType.CORRIDOR, null, corridor.corridorId(), null, headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.Room room) {
            return new DungeonPositionRef(mapId, CampaignDungeonLocationType.ROOM, room.roomId(), null, null, headingValue);
        }
        return new DungeonPositionRef(mapId, null, null, null, null, headingValue);
    }

    static String formatTile(Point2i tile) {
        return tile == null ? null : TILE_PREFIX + tile.x() + "," + tile.y();
    }

    private static Point2i parseTile(String value) {
        if (value == null || !value.startsWith(TILE_PREFIX)) {
            return null;
        }
        String coordinates = value.substring(TILE_PREFIX.length());
        int separator = coordinates.indexOf(',');
        if (separator <= 0 || separator >= coordinates.length() - 1) {
            return null;
        }
        try {
            int x = Integer.parseInt(coordinates.substring(0, separator));
            int y = Integer.parseInt(coordinates.substring(separator + 1));
            return new Point2i(x, y);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static Point2i roomAnchor(DungeonLayout layout, Long roomId) {
        Room room = layout.findRoom(roomId);
        if (room == null || room.floor() == null) {
            return null;
        }
        Point2i center = room.floor().shape().centerCell();
        return layout.isTraversableCell(center) ? center : layout.nearestTraversableCell(center);
    }

    private static Point2i corridorAnchor(Corridor corridor) {
        return corridor == null || corridor.path() == null || corridor.path().floor() == null
                ? null
                : corridor.path().floor().shape().centerCell();
    }

    private static Point2i corridorNetworkAnchor(DungeonLayout layout, String networkId) {
        CorridorNetwork network = layout.findCorridorNetwork(networkId);
        return network == null || network.floor() == null ? null : network.floor().shape().centerCell();
    }
}
