package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.TraversalPlanningInputProjector;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalReadModelProjection;
import features.world.dungeonmap.model.structures.traversal.TraversalReadModelProjector;
import features.world.dungeonmap.model.structures.traversal.TraversalRewriteContext;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonClusterMoveProjectionApplicationService {

    public DungeonClusterMoveProjection project(
            DungeonLayout layout,
            Long clusterId,
            Point2i delta,
            int levelDelta
    ) {
        DungeonLayout baseLayout = Objects.requireNonNull(layout, "layout");
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        RoomCluster cluster = baseLayout.findCluster(clusterId);
        if (clusterId == null || cluster == null || (!translate && levelDelta == 0)) {
            return new DungeonClusterMoveProjection(baseLayout, cluster, baseLayout.traversalsById(), Map.of());
        }

        RoomCluster movedCluster = cluster.movedBy(delta, levelDelta);
        List<RoomCluster> updatedClusters = baseLayout.clusters().stream()
                .map(existing -> Objects.equals(clusterId, existing.clusterId()) ? movedCluster : existing)
                .toList();
        Map<Long, Integer> updatedClusterLevels = updatedClusterLevels(baseLayout, clusterId, levelDelta);
        DungeonLayout provisionalLayout = new DungeonLayout(
                baseLayout.mapId(),
                baseLayout.name(),
                baseLayout.traversals(),
                baseLayout.corridors(),
                updatedClusters,
                baseLayout.stairs(),
                baseLayout.transitions(),
                updatedClusterLevels);

        Set<Long> affectedTraversalIds = baseLayout.traversalIdsAffectedBy(movedCluster.roomIds(), Set.of(clusterId));
        Traversal.RewriteResult rewriteResult = Traversal.rewriteAll(
                new LinkedHashMap<>(baseLayout.traversalsById()),
                new TraversalRewriteContext(
                        TraversalPlanningInputProjector.project(baseLayout),
                        TraversalPlanningInputProjector.project(provisionalLayout),
                        affectedTraversalIds,
                        Set.of()));
        List<Traversal> updatedTraversals = updatedTraversals(baseLayout, rewriteResult.traversalsById());
        TraversalReadModelProjection affectedProjection = TraversalReadModelProjector.project(
                baseLayout.mapId(),
                updatedTraversals.stream()
                        .filter(traversal -> traversal != null
                                && traversal.traversalId() != null
                                && affectedTraversalIds.contains(traversal.traversalId()))
                        .toList(),
                TraversalPlanningInputProjector.project(provisionalLayout),
                rewriteResult.traversalPlansByTraversalId(),
                Map.of(),
                baseLayout);
        DungeonLayout projectedLayout = new DungeonLayout(
                baseLayout.mapId(),
                baseLayout.name(),
                updatedTraversals,
                mergeCorridors(baseLayout, updatedTraversals, affectedTraversalIds, affectedProjection.corridors()),
                updatedClusters,
                mergeStairs(baseLayout, updatedTraversals, affectedTraversalIds, affectedProjection.stairs()),
                baseLayout.transitions(),
                updatedClusterLevels);
        return new DungeonClusterMoveProjection(
                projectedLayout,
                projectedLayout.findCluster(clusterId),
                rewriteResult.traversalsById(),
                rewriteResult.traversalPlansByTraversalId());
    }

    private static Map<Long, Integer> updatedClusterLevels(DungeonLayout layout, Long clusterId, int levelDelta) {
        LinkedHashMap<Long, Integer> levels = new LinkedHashMap<>();
        for (RoomCluster existing : layout.clusters()) {
            if (existing != null && existing.clusterId() != null) {
                levels.put(existing.clusterId(), layout.levelForCluster(existing.clusterId()));
            }
        }
        if (clusterId != null) {
            levels.put(clusterId, layout.levelForCluster(clusterId) + levelDelta);
        }
        return Map.copyOf(levels);
    }

    private static List<Traversal> updatedTraversals(DungeonLayout layout, Map<Long, Traversal> traversalsById) {
        ArrayList<Traversal> updated = new ArrayList<>();
        for (Traversal traversal : layout.traversals()) {
            if (traversal == null || traversal.traversalId() == null) {
                updated.add(traversal);
                continue;
            }
            updated.add(traversalsById.getOrDefault(traversal.traversalId(), traversal));
        }
        return List.copyOf(updated);
    }

    private static List<Corridor> mergeCorridors(
            DungeonLayout baseLayout,
            List<Traversal> updatedTraversals,
            Set<Long> affectedTraversalIds,
            List<Corridor> affectedCorridors
    ) {
        Map<Long, List<Corridor>> baseByTraversalId = groupCorridorsByTraversalId(baseLayout.corridors());
        Map<Long, List<Corridor>> affectedByTraversalId = groupCorridorsByTraversalId(affectedCorridors);
        ArrayList<Corridor> merged = new ArrayList<>();
        LinkedHashSet<Long> emittedTraversalIds = new LinkedHashSet<>();
        for (Traversal traversal : updatedTraversals) {
            if (traversal == null || traversal.traversalId() == null || !emittedTraversalIds.add(traversal.traversalId())) {
                continue;
            }
            if (affectedTraversalIds.contains(traversal.traversalId())) {
                merged.addAll(affectedByTraversalId.getOrDefault(traversal.traversalId(), List.of()));
            } else {
                merged.addAll(baseByTraversalId.getOrDefault(traversal.traversalId(), List.of()));
            }
        }
        for (Corridor corridor : baseLayout.corridors()) {
            if (corridor != null && corridor.traversalId() == null) {
                merged.add(corridor);
            }
        }
        return List.copyOf(merged);
    }

    private static List<DungeonStair> mergeStairs(
            DungeonLayout baseLayout,
            List<Traversal> updatedTraversals,
            Set<Long> affectedTraversalIds,
            List<DungeonStair> affectedStairs
    ) {
        Map<Long, List<DungeonStair>> baseByTraversalId = groupStairsByTraversalId(baseLayout.stairs());
        Map<Long, List<DungeonStair>> affectedByTraversalId = groupStairsByTraversalId(affectedStairs);
        ArrayList<DungeonStair> merged = new ArrayList<>();
        LinkedHashSet<Long> emittedTraversalIds = new LinkedHashSet<>();
        for (Traversal traversal : updatedTraversals) {
            if (traversal == null || traversal.traversalId() == null || !emittedTraversalIds.add(traversal.traversalId())) {
                continue;
            }
            if (affectedTraversalIds.contains(traversal.traversalId())) {
                merged.addAll(affectedByTraversalId.getOrDefault(traversal.traversalId(), List.of()));
            } else {
                merged.addAll(baseByTraversalId.getOrDefault(traversal.traversalId(), List.of()));
            }
        }
        for (DungeonStair stair : baseLayout.stairs()) {
            if (stair != null && stair.traversalId() == null) {
                merged.add(stair);
            }
        }
        return List.copyOf(merged);
    }

    private static Map<Long, List<Corridor>> groupCorridorsByTraversalId(List<Corridor> corridors) {
        LinkedHashMap<Long, List<Corridor>> grouped = new LinkedHashMap<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor == null || corridor.traversalId() == null) {
                continue;
            }
            grouped.computeIfAbsent(corridor.traversalId(), ignored -> new ArrayList<>()).add(corridor);
        }
        return grouped;
    }

    private static Map<Long, List<DungeonStair>> groupStairsByTraversalId(List<DungeonStair> stairs) {
        LinkedHashMap<Long, List<DungeonStair>> grouped = new LinkedHashMap<>();
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair == null || stair.traversalId() == null) {
                continue;
            }
            grouped.computeIfAbsent(stair.traversalId(), ignored -> new ArrayList<>()).add(stair);
        }
        return grouped;
    }
}
