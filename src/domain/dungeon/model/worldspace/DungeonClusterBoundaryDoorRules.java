package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.door.Door;
import src.domain.dungeon.model.core.structure.door.DoorBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.door.DoorIndex;
import src.domain.dungeon.model.core.structure.room.RoomClusterDoorBoundaryMaterialization;

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
        boolean corridorBound = resolvedKind == DungeonClusterBoundaryKind.DOOR
                && CORRIDOR_BINDING_LOOKUP_SERVICE.touchesCorridorBinding(
                dungeonMap,
                target.cluster().center(),
                target.cluster().clusterId(),
                existing.level(),
                Set.of(key));
        if (resolvedKind == DungeonClusterBoundaryKind.DOOR) {
            DoorIndex currentDoors = DoorIndex.from(doors(boundaries.values()));
            DoorIndex expectedAfterDelete = DoorIndex.from(doorsExcept(existing, boundaries.values()));
            DoorIndex actualAfterDelete = currentDoors.withoutDoor(door(existing), corridorBound);
            if (!actualAfterDelete.doors().equals(expectedAfterDelete.doors())) {
                return false;
            }
        }
        boundaries.remove(key);
        return true;
    }

    boolean upsertBoundaryIfAllowed(
            Map<Long, List<Cell>> roomCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonClusterBoundaryKind resolvedKind,
            Edge edge,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing,
            DungeonClusterBoundary candidate
    ) {
        DungeonClusterBoundary resolvedCandidate = candidate;
        if (resolvedKind == DungeonClusterBoundaryKind.DOOR) {
            resolvedCandidate = doorBoundary(candidate);
            if (!doorInsertionAllowed(roomCells, boundaries, edge, existing, resolvedCandidate)) {
                return false;
            }
        }
        if (resolvedKind == DungeonClusterBoundaryKind.WALL
                && existing != null
                && existing.kind() == DungeonClusterBoundaryKind.DOOR) {
            return false;
        }
        if (existing != null && existing.kind() == resolvedKind) {
            return false;
        }
        boundaries.put(key, resolvedCandidate);
        return true;
    }

    private boolean doorInsertionAllowed(
            Map<Long, List<Cell>> roomCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Edge edge,
            @Nullable DungeonClusterBoundary existing,
            DungeonClusterBoundary candidate
    ) {
        if (!RoomClusterDoorBoundaryMaterialization.forEdge(edge, roomCells, boundaryKind(existing))
                .materializesDoor()) {
            return false;
        }
        DoorIndex currentDoors = DoorIndex.from(doors(boundaries.values()));
        return !currentDoors.withDoor(door(candidate)).equals(currentDoors);
    }

    private static DoorBoundaryMaterialization.ExistingBoundaryKind boundaryKind(
            @Nullable DungeonClusterBoundary boundary
    ) {
        if (boundary == null) {
            return DoorBoundaryMaterialization.ExistingBoundaryKind.NONE;
        }
        if (boundary.kind() == DungeonClusterBoundaryKind.DOOR) {
            return DoorBoundaryMaterialization.ExistingBoundaryKind.DOOR;
        }
        return DoorBoundaryMaterialization.ExistingBoundaryKind.NON_DOOR;
    }

    private static List<Door> doors(Iterable<DungeonClusterBoundary> boundaries) {
        return doorsExcept(null, boundaries);
    }

    private static List<Door> doorsExcept(DungeonClusterBoundary removed, Iterable<DungeonClusterBoundary> boundaries) {
        List<Door> result = new ArrayList<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            if (boundary != null && boundary != removed && boundary.kind() == DungeonClusterBoundaryKind.DOOR) {
                result.add(door(boundary));
            }
        }
        return List.copyOf(result);
    }

    private static Door door(DungeonClusterBoundary boundary) {
        return new Door(
                boundary.resolvedTopologyRef(null).id(),
                0L,
                boundary.clusterId(),
                boundary.relativeCell(),
                boundary.direction());
    }

    private static Door doorBoundaryProjection(DungeonClusterBoundary boundary) {
        return door(boundary);
    }

    private static DungeonClusterBoundary doorBoundary(DungeonClusterBoundary candidate) {
        Door.BoundaryState state = doorBoundaryProjection(candidate).doorBoundaryState();
        return new DungeonClusterBoundary(
                state.clusterId(),
                state.level(),
                state.relativeCell(),
                state.direction(),
                DungeonClusterBoundaryKind.DOOR,
                candidate.topologyRef());
    }

    DungeonClusterBoundary restoredWallBoundary(DungeonClusterBoundary doorBoundary) {
        Door.BoundaryState state = doorBoundaryProjection(doorBoundary).restoredWallState();
        return new DungeonClusterBoundary(
                state.clusterId(),
                state.level(),
                state.relativeCell(),
                state.direction(),
                DungeonClusterBoundaryKind.WALL,
                DungeonTopologyRef.empty());
    }
}
