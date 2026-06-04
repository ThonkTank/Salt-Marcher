package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

final class DungeonClusterBoundaryDoorRules {

    private static final DungeonCorridorBindingLookupLogic CORRIDOR_BINDING_LOOKUP_SERVICE =
            new DungeonCorridorBindingLookupLogic();
    private static final DungeonClusterBoundaryDoorDecisionAdapter DOOR_DECISION_ADAPTER =
            new DungeonClusterBoundaryDoorDecisionAdapter();

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
                && !DOOR_DECISION_ADAPTER.allowsDoorMaterialization(existing, edge, roomCells)) {
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
}
