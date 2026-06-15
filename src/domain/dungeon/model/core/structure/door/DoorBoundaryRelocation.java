package src.domain.dungeon.model.core.structure.door;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterDoorBoundaryMove;

/**
 * Keeps authored door boundary geometry aligned with moved corridor door bindings.
 */
public final class DoorBoundaryRelocation {

    public DungeonMap relocateMovedDoorBinding(
            DungeonMap sourceMap,
            DungeonMap movedMap,
            CorridorDoorBindingState oldBinding,
            CorridorDoorBindingState newBinding
    ) {
        DungeonMap safeSourceMap = Objects.requireNonNull(sourceMap, "sourceMap");
        DungeonMap safeMovedMap = Objects.requireNonNull(movedMap, "movedMap");
        if (oldBinding == null || newBinding == null || safeMovedMap.equals(safeSourceMap)) {
            return safeMovedMap;
        }
        List<DungeonRoomCluster> nextClusters = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoomCluster candidate : safeMovedMap.topology().roomClusters()) {
            if (candidate.clusterId() == newBinding.clusterId()) {
                DungeonRoomCluster movedDoor = candidate.withMovedDoorBoundary(new RoomClusterDoorBoundaryMove(
                        doorEdge(safeSourceMap, oldBinding),
                        newBinding.relativeCell(),
                        newBinding.direction(),
                        newBinding.topologyRef()));
                nextClusters.add(movedDoor);
                changed = changed || !movedDoor.equals(candidate);
            } else {
                nextClusters.add(candidate);
            }
        }
        return changed
                ? new DungeonMap(
                        safeMovedMap.metadata(),
                        safeMovedMap.topology().withRoomClusters(nextClusters),
                        null,
                        safeMovedMap.rooms(),
                        safeMovedMap.corridors(),
                        safeMovedMap.stairs(),
                        safeMovedMap.transitionCatalog(),
                        safeMovedMap.revision())
                : safeMovedMap;
    }

    private static Edge doorEdge(DungeonMap dungeonMap, CorridorDoorBindingState binding) {
        DungeonRoomCluster cluster = cluster(dungeonMap, binding.clusterId());
        Cell center = cluster == null ? new Cell(0, 0, binding.relativeCell().level()) : cluster.center();
        Cell absoluteCell = new Cell(
                center.q() + binding.relativeCell().q(),
                center.r() + binding.relativeCell().r(),
                binding.relativeCell().level());
        return binding.direction().edgeOf(absoluteCell);
    }

    private static @Nullable DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        if (dungeonMap == null) {
            return null;
        }
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                return cluster;
            }
        }
        return null;
    }
}
