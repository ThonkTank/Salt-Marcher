package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;

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
                candidateCorridors,
                movedCorridorIds,
                nextStairs,
                nextTransitions,
                true);
    }

    DungeonMap moveCorridors(
            DungeonMap sourceMap,
            List<Corridor> candidateCorridors,
            Set<Long> movedCorridorIds,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions,
            boolean snapAnchorsToCurrentHosts
    ) {
        return moveCorridors(
                sourceMap,
                sourceMap,
                candidateCorridors,
                movedCorridorIds,
                nextStairs,
                nextTransitions,
                snapAnchorsToCurrentHosts);
    }

    DungeonMap moveCorridors(
            DungeonMap sourceMap,
            DungeonMap currentMap,
            List<Corridor> candidateCorridors,
            Set<Long> movedCorridorIds,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions
    ) {
        return moveCorridors(
                sourceMap,
                currentMap,
                candidateCorridors,
                movedCorridorIds,
                nextStairs,
                nextTransitions,
                true,
                true);
    }

    /**
     * Re-resolves corridor hosts after a room-cluster relocation while preserving
     * separately referenced anchors that now share the same resolved host cell.
     */
    DungeonMap moveCorridorsForClusterRelocation(
            DungeonMap sourceMap,
            DungeonMap currentMap,
            List<Corridor> candidateCorridors,
            Set<Long> movedCorridorIds,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions
    ) {
        return moveCorridors(
                sourceMap,
                currentMap,
                candidateCorridors,
                movedCorridorIds,
                nextStairs,
                nextTransitions,
                true,
                false);
    }

    DungeonMap moveCorridors(
            DungeonMap sourceMap,
            DungeonMap currentMap,
            List<Corridor> candidateCorridors,
            Set<Long> movedCorridorIds,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions,
            boolean snapAnchorsToCurrentHosts
    ) {
        return moveCorridors(
                sourceMap,
                currentMap,
                candidateCorridors,
                movedCorridorIds,
                nextStairs,
                nextTransitions,
                snapAnchorsToCurrentHosts,
                true);
    }

    private DungeonMap moveCorridors(
            DungeonMap sourceMap,
            DungeonMap currentMap,
            List<Corridor> candidateCorridors,
            Set<Long> movedCorridorIds,
            StairCollection nextStairs,
            TransitionCatalog nextTransitions,
            boolean snapAnchorsToCurrentHosts,
            boolean rejectDuplicateMovedAnchorCells
    ) {
        List<Corridor> normalizedCandidates = nonNullCorridors(candidateCorridors);
        Set<Long> normalizedMovedIds = normalizedCorridorIds(movedCorridorIds);
        if (normalizedCandidates.isEmpty() || normalizedMovedIds.isEmpty()) {
            return currentMap;
        }
        List<Corridor> resolvedCorridors = resolvedCorridors(
                currentMap,
                normalizedCandidates,
                snapAnchorsToCurrentHosts);
        if (rejectDuplicateMovedAnchorCells
                && MOVEMENT_ANCHORS.hasDuplicateMovedAnchorCells(resolvedCorridors, normalizedMovedIds)) {
            return sourceMap;
        }
        Map<CorridorNetwork.AnchorKey, CorridorAnchorDependencyUpdate.AnchorMovement> movedAnchors =
                MOVEMENT_ANCHORS.movedAnchors(
                        sourceMap.corridors(),
                        resolvedCorridors,
                        normalizedMovedIds);
        CorridorAnchorDependencyUpdate.DependencyUpdateResult dependencyUpdate =
                ANCHOR_DEPENDENCY_UPDATE.rerouteDependents(
                        currentMap,
                        sourceMap,
                        resolvedCorridors,
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
                nextTransitions,
                snapAnchorsToCurrentHosts);
    }

    private static List<Corridor> resolvedCorridors(
            DungeonMap currentMap,
            List<Corridor> candidateCorridors,
            boolean snapAnchorsToCurrentHosts
    ) {
        if (!snapAnchorsToCurrentHosts) {
            return candidateCorridors;
        }
        CorridorHostCells hostCells = new CorridorHostCells(HOST_CELL_QUERY.cellsByCorridor(
                currentMap,
                candidateCorridors));
        return CONNECTION_NORMALIZATION.snapOwnedAnchors(candidateCorridors, hostCells);
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
