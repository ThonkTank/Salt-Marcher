package src.domain.dungeon.model.map.model;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

final class DungeonClusterBoundaryDoorRules {

    private static final DungeonCorridorBindingLookupLogic CORRIDOR_BINDING_LOOKUP_SERVICE =
            new DungeonCorridorBindingLookupLogic();

    boolean removeBoundaryIfAllowed(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonClusterBoundaryKind resolvedKind,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing
    ) {
        if (existing == null || existing.kind() != resolvedKind) {
            return false;
        }
        if (resolvedKind == DungeonClusterBoundaryKind.DOOR
                && CORRIDOR_BINDING_LOOKUP_SERVICE.touchesCorridorBinding(
                dungeonMap,
                target.cluster().center(),
                target.cluster().clusterId(),
                existing.level(),
                Set.of(key))) {
            return false;
        }
        boundaries.remove(key);
        return true;
    }

    boolean upsertBoundaryIfAllowed(
            Map<Long, List<DungeonCell>> roomCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonClusterBoundaryKind resolvedKind,
            DungeonEdge edge,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing,
            DungeonClusterBoundary candidate
    ) {
        if (resolvedKind == DungeonClusterBoundaryKind.DOOR
                && !editableDoorBoundary(existing, edge, roomCells)) {
            return false;
        }
        if (resolvedKind == DungeonClusterBoundaryKind.WALL
                && existing != null
                && existing.kind() == DungeonClusterBoundaryKind.DOOR) {
            return false;
        }
        if (existing != null && existing.kind() == resolvedKind) {
            return false;
        }
        boundaries.put(key, candidate);
        return true;
    }

    private boolean editableDoorBoundary(
            @Nullable DungeonClusterBoundary existing,
            DungeonEdge edge,
            Map<Long, List<DungeonCell>> roomCells
    ) {
        long touchingRoomCount = touchingRoomCount(edge, roomCells);
        if (touchesMultipleRooms(touchingRoomCount)) {
            return existing != null && existing.kind() != DungeonClusterBoundaryKind.DOOR;
        }
        return touchesSingleRoom(touchingRoomCount) && (existing == null || existing.kind() != DungeonClusterBoundaryKind.DOOR);
    }

    private long touchingRoomCount(DungeonEdge edge, Map<Long, List<DungeonCell>> cellsByRoom) {
        if (edge == null || cellsByRoom.isEmpty()) {
            return 0L;
        }
        Set<DungeonCell> touching = Set.copyOf(edge.touchingCells());
        long result = 0L;
        for (List<DungeonCell> roomCells : cellsByRoom.values()) {
            if (touchesRoom(roomCells, touching)) {
                result++;
                if (touchesMultipleRooms(result)) {
                    return result;
                }
            }
        }
        return result;
    }

    private boolean touchesMultipleRooms(long touchingRoomCount) {
        return touchingRoomCount > 1L;
    }

    private boolean touchesSingleRoom(long touchingRoomCount) {
        return touchingRoomCount == 1L;
    }

    private boolean touchesRoom(List<DungeonCell> roomCells, Set<DungeonCell> touching) {
        for (DungeonCell cell : roomCells == null ? List.<DungeonCell>of() : roomCells) {
            if (touching.contains(cell)) {
                return true;
            }
        }
        return false;
    }
}
