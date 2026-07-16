package features.dungeon.domain.core.structure.corridor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;

/**
 * Lets room-cluster movement reuse corridor-owned route and dependent-anchor policy.
 */
public final class RoomClusterCorridorMovement {
    private static final CorridorNetworkMovement NETWORK_MOVEMENT = new CorridorNetworkMovement();
    private static final CorridorHostCellQuery HOST_CELL_QUERY = new CorridorHostCellQuery();
    private static final CorridorConnectionNormalization CONNECTION_NORMALIZATION =
            new CorridorConnectionNormalization();

    public DungeonMap moveAffectedCorridors(DungeonMap sourceMap, DungeonMap clusterMovedMap) {
        Objects.requireNonNull(sourceMap, "sourceMap");
        Objects.requireNonNull(clusterMovedMap, "clusterMovedMap");
        Set<Long> movedCorridorIds = movedCorridorIds(sourceMap, clusterMovedMap);
        if (movedCorridorIds.isEmpty()) {
            return clusterMovedMap;
        }
        return NETWORK_MOVEMENT.moveCorridors(
                sourceMap,
                clusterMovedMap,
                clusterMovedMap.corridors(),
                movedCorridorIds,
                clusterMovedMap.stairs(),
                clusterMovedMap.transitionCatalog());
    }

    private static Set<Long> movedCorridorIds(DungeonMap sourceMap, DungeonMap clusterMovedMap) {
        List<Corridor> candidateCorridors = clusterMovedMap.corridors();
        Map<CorridorNetwork.AnchorKey, Cell> sourceAnchors = snappedAnchorCells(sourceMap, candidateCorridors);
        Map<CorridorNetwork.AnchorKey, Cell> movedAnchors = snappedAnchorCells(clusterMovedMap, candidateCorridors);
        Set<Long> result = new LinkedHashSet<>();
        for (Corridor corridor : candidateCorridors == null ? List.<Corridor>of() : candidateCorridors) {
            if (corridor == null) {
                continue;
            }
            if (hasMovedOwnedAnchor(corridor, sourceAnchors, movedAnchors)) {
                result.add(corridor.corridorId());
            }
        }
        return Set.copyOf(result);
    }

    private static boolean hasMovedOwnedAnchor(
            Corridor corridor,
            Map<CorridorNetwork.AnchorKey, Cell> sourceAnchors,
            Map<CorridorNetwork.AnchorKey, Cell> movedAnchors
    ) {
        for (CorridorAnchor anchor : corridor.stateBindings().anchorBindings()) {
            if (anchor == null) {
                continue;
            }
            CorridorNetwork.AnchorKey key = CorridorNetwork.AnchorKey.from(anchor);
            Cell sourceCell = sourceAnchors.get(key);
            Cell movedCell = movedAnchors.get(key);
            if (sourceCell != null && movedCell != null && !sourceCell.equals(movedCell)) {
                return true;
            }
        }
        return false;
    }

    private static Map<CorridorNetwork.AnchorKey, Cell> snappedAnchorCells(
            DungeonMap dungeonMap,
            List<Corridor> corridors
    ) {
        CorridorHostCells hostCells = new CorridorHostCells(HOST_CELL_QUERY.cellsByCorridor(dungeonMap, corridors));
        List<Corridor> snappedCorridors = CONNECTION_NORMALIZATION.snapOwnedAnchors(corridors, hostCells);
        Map<CorridorNetwork.AnchorKey, Cell> result = new LinkedHashMap<>();
        for (Corridor corridor : snappedCorridors) {
            if (corridor == null) {
                continue;
            }
            for (CorridorAnchor anchor : corridor.stateBindings().anchorBindings()) {
                if (anchor != null) {
                    result.put(CorridorNetwork.AnchorKey.from(anchor), anchor.position());
                }
            }
        }
        return Map.copyOf(result);
    }
}
