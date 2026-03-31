package features.world.dungeonmap.application.runtime;

import features.campaignstate.api.CampaignDungeonLocationType;
import features.campaignstate.api.DungeonPositionRef;
import features.campaignstate.api.DungeonPositionSummary;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;

import java.util.Objects;

final class DungeonRuntimeLocations {

    private static final String TILE_PREFIX = "tile:";
    private static final String CORRIDOR_PREFIX = "corridor:";

    private DungeonRuntimeLocations() {
    }

    static DungeonRuntimeLocation toRuntimeLocation(DungeonPositionSummary position) {
        if (position == null) {
            return null;
        }
        if (position.locationType() == CampaignDungeonLocationType.TILE && position.locationKey() != null) {
            CubePoint tile = parseTile(position.locationKey());
            return tile == null ? null : DungeonRuntimeLocation.tile(tile);
        }
        if (position.locationType() == CampaignDungeonLocationType.STAIR_EXIT && position.locationKey() != null) {
            CubePoint tile = parseStairTile(position.locationKey());
            long stairId = parseStairId(position.locationKey());
            return tile == null || stairId <= 0 ? null : DungeonRuntimeLocation.stairExit(stairId, tile);
        }
        if (position.locationType() == CampaignDungeonLocationType.TRANSITION && position.locationKey() != null) {
            Long transitionId = parseTransitionId(position.locationKey());
            return transitionId == null ? null : DungeonRuntimeLocation.transition(transitionId);
        }
        if (position.locationType() == CampaignDungeonLocationType.CORRIDOR && position.corridorId() != null) {
            return DungeonRuntimeLocation.corridor(position.corridorId(), parseCorridorTile(position.locationKey()));
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
        CubePoint resolvedTile = null;
        if (location instanceof DungeonRuntimeLocation.Tile tileLocation) {
            resolvedTile = layout.isTraversableCell(tileLocation.tile()) ? tileLocation.tile() : null;
        } else if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            resolvedTile = stairExitAnchor(layout, stairExit.stairId(), stairExit.tile());
        } else if (location instanceof DungeonRuntimeLocation.Transition transitionLocation) {
            resolvedTile = transitionAnchor(layout, transitionLocation.transitionId());
        } else if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            resolvedTile = roomAnchor(layout, roomLocation.roomId());
        } else if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            resolvedTile = corridorAnchor(layout, layout.findCorridor(corridorLocation.corridorId()), corridorLocation.anchorTile());
        }
        if (resolvedTile != null) {
            return DungeonRuntimeLocation.tile(resolvedTile);
        }
        CubePoint fallbackTile = layout.rooms().stream()
                .sorted(java.util.Comparator.comparing(room -> room.roomId() == null ? Long.MAX_VALUE : room.roomId()))
                .map(room -> roomAnchor(layout, room.roomId()))
                .filter(Objects::nonNull)
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
        if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            return stairExitAnchor(layout, stairExit.stairId(), stairExit.tile()) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Transition transition) {
            return transitionAnchor(layout, transition.transitionId()) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            return corridorAnchor(layout, layout.findCorridor(corridor.corridorId()), corridor.anchorTile()) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Room room) {
            return layout.findRoom(room.roomId()) != null;
        }
        return false;
    }

    static DungeonPositionRef toCampaignPosition(long mapId, DungeonRuntimeLocation location, CardinalDirection heading) {
        String headingValue = (heading == null ? CardinalDirection.defaultDirection() : heading).name();
        if (location instanceof DungeonRuntimeLocation.Tile tile) {
            return new DungeonPositionRef(mapId, tile.tile().z(), CampaignDungeonLocationType.TILE, null, null, formatTile(tile.tile()), headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            return new DungeonPositionRef(
                    mapId,
                    stairExit.tile().z(),
                    CampaignDungeonLocationType.STAIR_EXIT,
                    null,
                    null,
                    formatStairExit(stairExit.stairId(), stairExit.tile()),
                    headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.Transition transition) {
            return new DungeonPositionRef(mapId, 0, CampaignDungeonLocationType.TRANSITION, null, null, formatTransition(transition.transitionId()), headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            return new DungeonPositionRef(
                    mapId,
                    corridor.anchorTile() == null ? 0 : corridor.anchorTile().z(),
                    CampaignDungeonLocationType.CORRIDOR,
                    null,
                    corridor.corridorId(),
                    formatCorridor(corridor.corridorId(), corridor.anchorTile()),
                    headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.Room room) {
            return new DungeonPositionRef(mapId, 0, CampaignDungeonLocationType.ROOM, room.roomId(), null, null, headingValue);
        }
        return new DungeonPositionRef(mapId, 0, null, null, null, null, headingValue);
    }

    static String formatTile(CubePoint tile) {
        return tile == null ? null : TILE_PREFIX + tile.x() + "," + tile.y() + "," + tile.z();
    }

    private static String formatStairExit(long stairId, CubePoint tile) {
        return "stair:" + stairId + ":" + tile.x() + "," + tile.y() + "," + tile.z();
    }

    private static String formatCorridor(long corridorId, CubePoint tile) {
        if (tile == null) {
            return null;
        }
        return CORRIDOR_PREFIX + corridorId + ":" + tile.x() + "," + tile.y() + "," + tile.z();
    }

    private static CubePoint parseTile(String value) {
        if (value == null || !value.startsWith(TILE_PREFIX)) {
            return null;
        }
        String coordinates = value.substring(TILE_PREFIX.length());
        String[] parts = coordinates.split(",");
        if (parts.length != 3) {
            return null;
        }
        try {
            int x = Integer.parseInt(parts[0]);
            int y = Integer.parseInt(parts[1]);
            int z = Integer.parseInt(parts[2]);
            return new CubePoint(x, y, z);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static CubePoint parseStairTile(String value) {
        if (value == null || !value.startsWith("stair:")) {
            return null;
        }
        int separator = value.indexOf(':', "stair:".length());
        if (separator <= "stair:".length() || separator >= value.length() - 1) {
            return null;
        }
        String coordinates = value.substring(separator + 1);
        String[] parts = coordinates.split(",");
        if (parts.length != 3) {
            return null;
        }
        try {
            return new CubePoint(
                    Integer.parseInt(parts[0]),
                    Integer.parseInt(parts[1]),
                    Integer.parseInt(parts[2]));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static long parseStairId(String value) {
        if (value == null || !value.startsWith("stair:")) {
            return -1L;
        }
        int separator = value.indexOf(':', "stair:".length());
        if (separator <= "stair:".length()) {
            return -1L;
        }
        try {
            return Long.parseLong(value.substring("stair:".length(), separator));
        } catch (NumberFormatException ignored) {
            return -1L;
        }
    }

    private static CubePoint parseCorridorTile(String value) {
        if (value == null || !value.startsWith(CORRIDOR_PREFIX)) {
            return null;
        }
        int separator = value.indexOf(':', CORRIDOR_PREFIX.length());
        if (separator <= CORRIDOR_PREFIX.length() || separator >= value.length() - 1) {
            return null;
        }
        String[] parts = value.substring(separator + 1).split(",");
        if (parts.length != 3) {
            return null;
        }
        try {
            return new CubePoint(
                    Integer.parseInt(parts[0]),
                    Integer.parseInt(parts[1]),
                    Integer.parseInt(parts[2]));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static String formatTransition(long transitionId) {
        return "transition:" + transitionId;
    }

    private static Long parseTransitionId(String value) {
        if (value == null || !value.startsWith("transition:")) {
            return null;
        }
        try {
            return Long.parseLong(value.substring("transition:".length()));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static CubePoint roomAnchor(DungeonLayout layout, Long roomId) {
        Room room = layout.findRoom(roomId);
        if (room == null || room.floor() == null) {
            return null;
        }
        Point2i center = room.floor().shape().centerCell();
        CubePoint preferred = CubePoint.at(center, layout.levelForRoom(roomId));
        return layout.isTraversableCell(preferred) ? preferred : layout.nearestTraversableCell(preferred);
    }

    private static CubePoint corridorAnchor(DungeonLayout layout, Corridor corridor, CubePoint preferred) {
        if (corridor != null) {
            return DungeonRuntimeCorridorGeometry.canonicalAnchor(layout, corridor);
        }
        if (layout == null || preferred == null) {
            return null;
        }
        Corridor fallback = layout.corridorsAtCell(preferred.projectedCell(), preferred.z()).stream()
                .filter(Objects::nonNull)
                .min(java.util.Comparator.comparing(Corridor::corridorId, java.util.Comparator.nullsLast(Long::compareTo)))
                .orElse(null);
        return fallback == null ? null : DungeonRuntimeCorridorGeometry.canonicalAnchor(layout, fallback);
    }

    private static CubePoint stairExitAnchor(DungeonLayout layout, long stairId, CubePoint preferred) {
        DungeonStair stair = layout.stairs().stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null && candidate.stairId() == stairId)
                .findFirst()
                .orElse(null);
        if (stair == null && preferred != null) {
            stair = layout.stairsAtCell(preferred.projectedCell(), preferred.z()).stream()
                    .filter(Objects::nonNull)
                    .min(java.util.Comparator.comparing(DungeonStair::stairId, java.util.Comparator.nullsLast(Long::compareTo)))
                    .orElse(null);
        }
        if (stair == null) {
            return null;
        }
        DungeonStair resolvedStair = stair;
        if (preferred != null) {
            for (DungeonStairExit exit : resolvedStair.exits()) {
                if (preferred.equals(exit.position())) {
                    return exit.position();
                }
            }
        }
        return resolvedStair.exits().stream()
                .map(DungeonStairExit::position)
                .findFirst()
                .orElseGet(() -> resolvedStair.path().stream().findFirst().orElse(null));
    }

    private static CubePoint transitionAnchor(DungeonLayout layout, long transitionId) {
        var transition = layout.findTransition(transitionId);
        return transition == null ? null : transition.anchor();
    }
}
