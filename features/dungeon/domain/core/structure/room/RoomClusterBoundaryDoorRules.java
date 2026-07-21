package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorDoorBindingGeometry;
import features.dungeon.domain.core.structure.door.DoorBoundaryMaterialization;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

final class RoomClusterBoundaryDoorRules {

    boolean removeBoundaryIfAllowed(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            BoundaryKind resolvedKind,
            DungeonBoundaryKey key,
            @Nullable BoundarySegment existing
    ) {
        if (existing == null || existing.kind() != resolvedKind) {
            return false;
        }
        if (resolvedKind == BoundaryKind.DOOR
                && new CorridorDoorBoundaryProtection(corridors, target, key, existing).corridorBound()) {
            return false;
        }
        boundaries.remove(key);
        return true;
    }

    boolean upsertBoundaryIfAllowed(
            Map<Long, List<Cell>> roomCells,
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            BoundaryKind resolvedKind,
            Edge edge,
            DungeonBoundaryKey key,
            @Nullable BoundarySegment existing,
            BoundarySegment candidate
    ) {
        BoundarySegment resolvedCandidate = candidate;
        if (resolvedKind == BoundaryKind.DOOR) {
            if (!RoomClusterDoorBoundaryMaterialization.forEdge(edge, roomCells, boundaryKind(existing))
                    .materializesDoor()) {
                return false;
            }
            resolvedCandidate = new BoundarySegment(candidate.edgeKey(), BoundaryKind.DOOR, candidate.topologyRef());
        }
        if (resolvedKind == BoundaryKind.WALL && existing != null && existing.isDoor()) {
            return false;
        }
        if (existing != null && existing.kind() == resolvedKind) {
            return false;
        }
        boundaries.put(key, resolvedCandidate);
        return true;
    }

    BoundarySegment restoredWallBoundary(BoundarySegment doorBoundary) {
        return new BoundarySegment(
                doorBoundary.edgeKey(),
                BoundaryKind.WALL,
                DungeonTopologyRef.empty());
    }

    private static DoorBoundaryMaterialization.ExistingBoundaryKind boundaryKind(
            @Nullable BoundarySegment boundary
    ) {
        if (boundary == null) {
            return DoorBoundaryMaterialization.ExistingBoundaryKind.NONE;
        }
        return boundary.isDoor()
                ? DoorBoundaryMaterialization.ExistingBoundaryKind.DOOR
                : DoorBoundaryMaterialization.ExistingBoundaryKind.NON_DOOR;
    }

    private record CorridorDoorBoundaryProtection(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            DungeonBoundaryKey key,
            BoundarySegment existing
    ) {
        boolean corridorBound() {
            return boundByGeometry() || boundByCurrentBoundaryKey() || boundByTopologyRef();
        }

        private boolean boundByGeometry() {
            return CorridorDoorBindingGeometry.touchesDoorBindingKeys(
                    corridors,
                    target.cluster().clusterId(),
                    existing.level(),
                    Set.of(key));
        }

        private boolean boundByTopologyRef() {
            DungeonTopologyRef ref = existing.resolvedTopologyRef();
            if (!ref.present()) {
                return false;
            }
            for (Corridor corridor : corridors) {
                for (CorridorDoorBinding binding : corridor.bindings().doorBindings()) {
                    if (ref.equals(binding.topologyRef())) {
                        return true;
                    }
                }
            }
            return false;
        }

        private boolean boundByCurrentBoundaryKey() {
            for (Corridor corridor : corridors) {
                for (CorridorDoorBinding binding : corridor.bindings().doorBindings()) {
                    if (binding.clusterId() == target.cluster().clusterId()
                            && binding.roomCell().level() == existing.level()
                            && key.equals(DungeonBoundaryKey.from(CorridorDoorBindingGeometry.doorEdge(binding)))) {
                        return true;
                    }
                }
            }
            return false;
        }
    }
}
