package features.world.dungeonmap.application.runtime;

import features.campaignstate.api.CampaignDungeonLocationType;
import features.campaignstate.api.DungeonPositionRef;
import features.campaignstate.api.DungeonPositionSummary;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
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
        Integer storedLevel = position.levelZ();
        if (position.locationType() == CampaignDungeonLocationType.TILE && position.locationKey() != null) {
            return parseCellLocation(position.locationKey(), TILE_PREFIX, storedLevel);
        }
        if (position.locationType() == CampaignDungeonLocationType.STAIR_EXIT && position.locationKey() != null) {
            DungeonRuntimeLocation.Cell cell = parseStairCell(position.locationKey(), storedLevel);
            long stairId = parseStairId(position.locationKey());
            return cell == null || stairId <= 0 ? null : DungeonRuntimeLocation.stairExit(stairId, cell.cell(), cell.levelZ());
        }
        if (position.locationType() == CampaignDungeonLocationType.TRANSITION && position.locationKey() != null) {
            Long transitionId = parseTransitionId(position.locationKey());
            return transitionId == null ? null : DungeonRuntimeLocation.transition(transitionId);
        }
        if (position.locationType() == CampaignDungeonLocationType.CORRIDOR && position.corridorId() != null) {
            DungeonRuntimeLocation.Cell anchor = parseCorridorCell(position.locationKey(), storedLevel);
            return anchor == null
                    ? DungeonRuntimeLocation.corridor(position.corridorId())
                    : DungeonRuntimeLocation.corridor(position.corridorId(), anchor.cell(), anchor.levelZ());
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
        DungeonRuntimeLocation.Cell resolvedCell = null;
        if (location instanceof DungeonRuntimeLocation.Cell cellLocation) {
            resolvedCell = layout.isTraversableCell(cellLocation.cell(), cellLocation.levelZ()) ? cellLocation : null;
        } else if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            resolvedCell = stairExitAnchor(layout, stairExit.stairId(), new DungeonRuntimeLocation.Cell(stairExit.cell(), stairExit.levelZ()));
        } else if (location instanceof DungeonRuntimeLocation.Transition transitionLocation) {
            resolvedCell = transitionAnchor(layout, transitionLocation.transitionId());
        } else if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            resolvedCell = roomAnchor(layout, roomLocation.roomId());
        } else if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            DungeonRuntimeLocation.Cell preferred = corridorLocation.anchorCell() == null
                    ? null
                    : new DungeonRuntimeLocation.Cell(corridorLocation.anchorCell(), corridorLocation.levelZ());
            resolvedCell = corridorAnchor(layout, layout.findCorridor(corridorLocation.corridorId()), preferred);
        }
        if (resolvedCell != null) {
            return resolvedCell;
        }
        DungeonRuntimeLocation.Cell fallback = layout.rooms().stream()
                .sorted(java.util.Comparator.comparing(room -> room.roomId() == null ? Long.MAX_VALUE : room.roomId()))
                .map(room -> roomAnchor(layout, room.roomId()))
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
        return fallback;
    }

    static boolean containsLocation(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (layout == null || location == null) {
            return false;
        }
        if (location instanceof DungeonRuntimeLocation.Cell cell) {
            return layout.isTraversableCell(cell.cell(), cell.levelZ());
        }
        if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            return stairExitAnchor(layout, stairExit.stairId(), new DungeonRuntimeLocation.Cell(stairExit.cell(), stairExit.levelZ())) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Transition transition) {
            return transitionAnchor(layout, transition.transitionId()) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            DungeonRuntimeLocation.Cell preferred = corridor.anchorCell() == null
                    ? null
                    : new DungeonRuntimeLocation.Cell(corridor.anchorCell(), corridor.levelZ());
            return corridorAnchor(layout, layout.findCorridor(corridor.corridorId()), preferred) != null;
        }
        if (location instanceof DungeonRuntimeLocation.Room room) {
            return layout.findRoom(room.roomId()) != null;
        }
        return false;
    }

    static DungeonPositionRef toCampaignPosition(long mapId, DungeonRuntimeLocation location, CardinalDirection heading) {
        String headingValue = (heading == null ? CardinalDirection.defaultDirection() : heading).name();
        if (location instanceof DungeonRuntimeLocation.Cell cell) {
            return new DungeonPositionRef(
                    mapId,
                    cell.levelZ(),
                    CampaignDungeonLocationType.TILE,
                    null,
                    null,
                    formatCellLocation(TILE_PREFIX, cell.cell(), cell.levelZ()),
                    headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            return new DungeonPositionRef(
                    mapId,
                    stairExit.levelZ(),
                    CampaignDungeonLocationType.STAIR_EXIT,
                    null,
                    null,
                    formatStairExit(stairExit.stairId(), stairExit.cell(), stairExit.levelZ()),
                    headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.Transition transition) {
            return new DungeonPositionRef(mapId, 0, CampaignDungeonLocationType.TRANSITION, null, null, formatTransition(transition.transitionId()), headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridor) {
            return new DungeonPositionRef(
                    mapId,
                    corridor.levelZ(),
                    CampaignDungeonLocationType.CORRIDOR,
                    null,
                    corridor.corridorId(),
                    formatCorridor(corridor.corridorId(), corridor.anchorCell(), corridor.levelZ()),
                    headingValue);
        }
        if (location instanceof DungeonRuntimeLocation.Room room) {
            return new DungeonPositionRef(mapId, 0, CampaignDungeonLocationType.ROOM, room.roomId(), null, null, headingValue);
        }
        return new DungeonPositionRef(mapId, 0, null, null, null, null, headingValue);
    }

    private static String formatCellLocation(String prefix, CellCoord cell, int levelZ) {
        return cell == null ? null : prefix + cell.x() + "," + cell.y() + "," + levelZ;
    }

    private static String formatStairExit(long stairId, CellCoord cell, int levelZ) {
        return cell == null ? null : "stair:" + stairId + ":" + cell.x() + "," + cell.y() + "," + levelZ;
    }

    private static String formatCorridor(long corridorId, CellCoord cell, int levelZ) {
        return cell == null ? null : CORRIDOR_PREFIX + corridorId + ":" + cell.x() + "," + cell.y() + "," + levelZ;
    }

    private static DungeonRuntimeLocation.Cell parseCellLocation(String value, String prefix, Integer fallbackLevel) {
        if (value == null || !value.startsWith(prefix)) {
            return null;
        }
        return parseCellCoordinates(value.substring(prefix.length()), fallbackLevel);
    }

    private static DungeonRuntimeLocation.Cell parseStairCell(String value, Integer fallbackLevel) {
        if (value == null || !value.startsWith("stair:")) {
            return null;
        }
        int separator = value.indexOf(':', "stair:".length());
        if (separator <= "stair:".length() || separator >= value.length() - 1) {
            return null;
        }
        return parseCellCoordinates(value.substring(separator + 1), fallbackLevel);
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

    private static DungeonRuntimeLocation.Cell parseCorridorCell(String value, Integer fallbackLevel) {
        if (value == null || !value.startsWith(CORRIDOR_PREFIX)) {
            return null;
        }
        int separator = value.indexOf(':', CORRIDOR_PREFIX.length());
        if (separator <= CORRIDOR_PREFIX.length() || separator >= value.length() - 1) {
            return null;
        }
        return parseCellCoordinates(value.substring(separator + 1), fallbackLevel);
    }

    private static DungeonRuntimeLocation.Cell parseCellCoordinates(String coordinates, Integer fallbackLevel) {
        if (coordinates == null) {
            return null;
        }
        String[] parts = coordinates.split(",");
        if (parts.length != 3) {
            return null;
        }
        try {
            int x = Integer.parseInt(parts[0]);
            int y = Integer.parseInt(parts[1]);
            int storedLevel = Integer.parseInt(parts[2]);
            int resolvedLevel = fallbackLevel == null ? storedLevel : fallbackLevel;
            return new DungeonRuntimeLocation.Cell(new CellCoord(x, y), resolvedLevel);
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

    private static DungeonRuntimeLocation.Cell roomAnchor(DungeonLayout layout, Long roomId) {
        Room room = layout.findRoom(roomId);
        if (room == null) {
            return null;
        }
        int levelZ = layout.levelForRoom(roomId);
        CellCoord preferred = room.structure().centerCellCoordAtLevel(levelZ);
        if (preferred == null) {
            return null;
        }
        CellCoord resolved = layout.isTraversableCell(preferred, levelZ)
                ? preferred
                : layout.nearestTraversableCell(preferred, levelZ);
        return resolved == null ? null : new DungeonRuntimeLocation.Cell(resolved, levelZ);
    }

    private static DungeonRuntimeLocation.Cell corridorAnchor(
            DungeonLayout layout,
            Corridor corridor,
            DungeonRuntimeLocation.Cell preferred
    ) {
        if (corridor != null) {
            CellCoord center = corridor.structure().centerCellCoordAtLevel(corridor.levelZ());
            return center == null ? null : new DungeonRuntimeLocation.Cell(center, corridor.levelZ());
        }
        if (layout == null || preferred == null) {
            return null;
        }
        Corridor fallback = layout.corridorsAtCell(preferred.cell(), preferred.levelZ()).stream()
                .filter(Objects::nonNull)
                .min(java.util.Comparator.comparing(Corridor::corridorId, java.util.Comparator.nullsLast(Long::compareTo)))
                .orElse(null);
        if (fallback == null) {
            return null;
        }
        CellCoord center = fallback.structure().centerCellCoordAtLevel(fallback.levelZ());
        return center == null ? null : new DungeonRuntimeLocation.Cell(center, fallback.levelZ());
    }

    private static DungeonRuntimeLocation.Cell stairExitAnchor(
            DungeonLayout layout,
            long stairId,
            DungeonRuntimeLocation.Cell preferred
    ) {
        DungeonStair stair = layout.stairs().stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null && candidate.stairId() == stairId)
                .findFirst()
                .orElse(null);
        if (stair == null && preferred != null) {
            stair = layout.stairsAtCell(preferred.cell(), preferred.levelZ()).stream()
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
                if (exit.position().projectedCell().equals(preferred.cell())
                        && exit.position().z() == preferred.levelZ()) {
                    return new DungeonRuntimeLocation.Cell(exit.position().projectedCell(), exit.position().z());
                }
            }
        }
        return resolvedStair.exits().stream()
                .map(exit -> new DungeonRuntimeLocation.Cell(exit.position().projectedCell(), exit.position().z()))
                .findFirst()
                .orElseGet(() -> resolvedStair.path().stream()
                        .findFirst()
                        .map(point -> new DungeonRuntimeLocation.Cell(point.projectedCell(), point.z()))
                        .orElse(null));
    }

    private static DungeonRuntimeLocation.Cell transitionAnchor(DungeonLayout layout, long transitionId) {
        var transition = layout.findTransition(transitionId);
        return transition == null || transition.anchor() == null
                ? null
                : new DungeonRuntimeLocation.Cell(transition.anchor().projectedCell(), transition.anchor().z());
    }
}
