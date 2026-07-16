package features.dungeon.domain.core.structure.corridor;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.geometry.Cell;

final class CorridorNetworkMovementAnchors {
    boolean hasDuplicateMovedAnchorCells(List<Corridor> corridors, Set<Long> movedCorridorIds) {
        for (Corridor corridor : corridors) {
            if (corridor == null || !movedCorridorIds.contains(corridor.corridorId())) {
                continue;
            }
            Set<Cell> anchorCells = new LinkedHashSet<>();
            for (CorridorAnchor anchor : corridor.stateBindings().anchorBindings()) {
                if (anchor != null && !anchorCells.add(anchor.position())) {
                    return true;
                }
            }
        }
        return false;
    }

    Map<CorridorNetwork.AnchorKey, CorridorAnchorDependencyUpdate.AnchorMovement> movedAnchors(
            List<Corridor> sourceCorridors,
            List<Corridor> snappedCorridors,
            Set<Long> movedCorridorIds
    ) {
        Map<CorridorNetwork.AnchorKey, Cell> previousCells = anchorCellsByKey(sourceCorridors, movedCorridorIds);
        Map<CorridorNetwork.AnchorKey, Cell> nextCells = anchorCellsByKey(snappedCorridors, movedCorridorIds);
        Map<CorridorNetwork.AnchorKey, CorridorAnchorDependencyUpdate.AnchorMovement> result = new LinkedHashMap<>();
        for (Map.Entry<CorridorNetwork.AnchorKey, Cell> entry : nextCells.entrySet()) {
            Cell previousCell = previousCells.get(entry.getKey());
            Cell nextCell = entry.getValue();
            if (previousCell != null && nextCell != null && !previousCell.equals(nextCell)) {
                result.put(
                        entry.getKey(),
                        new CorridorAnchorDependencyUpdate.AnchorMovement(previousCell, nextCell));
            }
        }
        return Map.copyOf(result);
    }

    private static Map<CorridorNetwork.AnchorKey, Cell> anchorCellsByKey(
            List<Corridor> corridors,
            Set<Long> corridorIds
    ) {
        Map<CorridorNetwork.AnchorKey, Cell> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor == null || !corridorIds.contains(corridor.corridorId())) {
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
