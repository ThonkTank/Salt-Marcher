package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

final class CorridorNetworkMovement {
    private static final CorridorConnectionNormalization CONNECTION_NORMALIZATION =
            new CorridorConnectionNormalization();
    private static final CorridorHostCellQuery HOST_CELL_QUERY = new CorridorHostCellQuery();
    private static final CorridorAnchorDependencyUpdate ANCHOR_DEPENDENCY_UPDATE =
            new CorridorAnchorDependencyUpdate();
    private static final CorridorNetworkMovementAnchors MOVEMENT_ANCHORS =
            new CorridorNetworkMovementAnchors();

    DungeonMap moveCorridors(
            DungeonMap sourceMap,
            List<Corridor> candidateCorridors,
            Set<Long> movedCorridorIds,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions
    ) {
        return moveCorridors(
                sourceMap,
                sourceMap,
                candidateCorridors,
                movedCorridorIds,
                nextStairs,
                nextTransitions);
    }

    DungeonMap moveCorridors(
            DungeonMap sourceMap,
            DungeonMap currentMap,
            List<Corridor> candidateCorridors,
            Set<Long> movedCorridorIds,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions
    ) {
        List<Corridor> normalizedCandidates = nonNullCorridors(candidateCorridors);
        Set<Long> normalizedMovedIds = normalizedCorridorIds(movedCorridorIds);
        if (normalizedCandidates.isEmpty() || normalizedMovedIds.isEmpty()) {
            return currentMap;
        }
        CorridorHostCells hostCells = new CorridorHostCells(HOST_CELL_QUERY.cellsByCorridor(currentMap, normalizedCandidates));
        List<Corridor> snappedCorridors = CONNECTION_NORMALIZATION.snapOwnedAnchors(normalizedCandidates, hostCells);
        if (MOVEMENT_ANCHORS.hasDuplicateMovedAnchorCells(snappedCorridors, normalizedMovedIds)) {
            return sourceMap;
        }
        Map<CorridorNetwork.AnchorKey, CorridorAnchorDependencyUpdate.AnchorMovement> movedAnchors =
                MOVEMENT_ANCHORS.movedAnchors(
                        sourceMap.corridors(),
                        snappedCorridors,
                        normalizedMovedIds);
        CorridorAnchorDependencyUpdate.DependencyUpdateResult dependencyUpdate =
                ANCHOR_DEPENDENCY_UPDATE.rerouteDependents(
                        currentMap,
                        snappedCorridors,
                        movedAnchors,
                        normalizedMovedIds);
        if (!dependencyUpdate.accepted()) {
            return sourceMap;
        }
        if (dependencyUpdate.corridors().equals(currentMap.corridors())) {
            return currentMap;
        }
        return CONNECTION_NORMALIZATION.copyWithConnections(
                currentMap,
                dependencyUpdate.corridors(),
                nextStairs,
                nextTransitions);
    }

    private static Set<Long> normalizedCorridorIds(Set<Long> source) {
        Set<Long> result = new LinkedHashSet<>();
        for (Long corridorId : source == null ? Set.<Long>of() : source) {
            if (corridorId != null && corridorId > 0L) {
                result.add(corridorId);
            }
        }
        return Set.copyOf(result);
    }

    private static List<Corridor> nonNullCorridors(List<Corridor> source) {
        List<Corridor> result = new ArrayList<>();
        for (Corridor corridor : source == null ? List.<Corridor>of() : source) {
            if (corridor != null) {
                result.add(corridor);
            }
        }
        return List.copyOf(result);
    }
}
