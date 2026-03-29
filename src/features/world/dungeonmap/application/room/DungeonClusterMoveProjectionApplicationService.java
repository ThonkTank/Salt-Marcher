package features.world.dungeonmap.application.room;

import features.world.dungeonmap.application.traversal.DungeonTraversalRewriteResult;
import features.world.dungeonmap.application.traversal.DungeonTraversalRewriteService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonClusterMoveProjectionApplicationService {

    private final DungeonTraversalRewriteService traversalRewriteService;

    public DungeonClusterMoveProjectionApplicationService(DungeonTraversalRewriteService traversalRewriteService) {
        this.traversalRewriteService = Objects.requireNonNull(traversalRewriteService, "traversalRewriteService");
    }

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
        DungeonTraversalRewriteResult rewriteResult = traversalRewriteService.rewriteForLayoutChange(
                baseLayout,
                provisionalLayout,
                baseLayout.traversalsById(),
                movedCluster.roomIds(),
                Set.of(clusterId),
                Set.of());
        List<Traversal> updatedTraversals = updatedTraversals(baseLayout, rewriteResult.traversalsById());
        DungeonLayout projectedLayout = new DungeonLayout(
                baseLayout.mapId(),
                baseLayout.name(),
                updatedTraversals,
                mergeCorridors(
                        baseLayout,
                        updatedTraversals,
                        rewriteResult.affectedTraversalIds(),
                        rewriteResult.traversalRoutesByTraversalId()),
                updatedClusters,
                mergeStairs(
                        baseLayout,
                        updatedTraversals,
                        rewriteResult.affectedTraversalIds(),
                        rewriteResult.traversalRoutesByTraversalId()),
                baseLayout.transitions(),
                updatedClusterLevels);
        return new DungeonClusterMoveProjection(
                projectedLayout,
                projectedLayout.findCluster(clusterId),
                rewriteResult.traversalsById(),
                rewriteResult.traversalRoutesByTraversalId());
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
            Map<Long, TraversalRoute> projectedRoutesByTraversalId
    ) {
        Map<Long, List<Corridor>> baseByTraversalId = groupCorridorsByTraversalId(baseLayout.traversals(), baseLayout.corridors());
        ArrayList<Corridor> merged = new ArrayList<>();
        LinkedHashSet<Long> emittedTraversalIds = new LinkedHashSet<>();
        for (Traversal traversal : updatedTraversals) {
            if (traversal == null || traversal.traversalId() == null || !emittedTraversalIds.add(traversal.traversalId())) {
                continue;
            }
            if (affectedTraversalIds.contains(traversal.traversalId())) {
                merged.addAll(corridorsForRoute(projectedRoutesByTraversalId.get(traversal.traversalId())));
            } else {
                merged.addAll(baseByTraversalId.getOrDefault(traversal.traversalId(), List.of()));
            }
        }
        merged.addAll(unownedCorridors(baseLayout.traversals(), baseLayout.corridors()));
        return List.copyOf(merged);
    }

    private static List<DungeonStair> mergeStairs(
            DungeonLayout baseLayout,
            List<Traversal> updatedTraversals,
            Set<Long> affectedTraversalIds,
            Map<Long, TraversalRoute> projectedRoutesByTraversalId
    ) {
        Map<Long, List<DungeonStair>> baseByTraversalId = groupStairsByTraversalId(baseLayout.traversals(), baseLayout.stairs());
        ArrayList<DungeonStair> merged = new ArrayList<>();
        LinkedHashSet<Long> emittedTraversalIds = new LinkedHashSet<>();
        for (Traversal traversal : updatedTraversals) {
            if (traversal == null || traversal.traversalId() == null || !emittedTraversalIds.add(traversal.traversalId())) {
                continue;
            }
            if (affectedTraversalIds.contains(traversal.traversalId())) {
                merged.addAll(stairsForRoute(projectedRoutesByTraversalId.get(traversal.traversalId())));
            } else {
                merged.addAll(baseByTraversalId.getOrDefault(traversal.traversalId(), List.of()));
            }
        }
        merged.addAll(unownedStairs(baseLayout.traversals(), baseLayout.stairs()));
        return List.copyOf(merged);
    }

    private static Map<Long, List<Corridor>> groupCorridorsByTraversalId(
            List<Traversal> traversals,
            List<Corridor> corridors
    ) {
        Map<Long, Corridor> corridorsById = corridorsById(corridors);
        LinkedHashMap<Long, List<Corridor>> grouped = new LinkedHashMap<>();
        for (Traversal traversal : traversals == null ? List.<Traversal>of() : traversals) {
            if (traversal == null || traversal.traversalId() == null) {
                continue;
            }
            for (Long corridorId : traversal.segmentRefs().corridorIdsBySegmentKey().values()) {
                Corridor corridor = corridorId == null ? null : corridorsById.get(corridorId);
                if (corridor != null) {
                    grouped.computeIfAbsent(traversal.traversalId(), ignored -> new ArrayList<>()).add(corridor);
                }
            }
        }
        return grouped;
    }

    private static Map<Long, List<DungeonStair>> groupStairsByTraversalId(
            List<Traversal> traversals,
            List<DungeonStair> stairs
    ) {
        Map<Long, DungeonStair> stairsById = stairsById(stairs);
        LinkedHashMap<Long, List<DungeonStair>> grouped = new LinkedHashMap<>();
        for (Traversal traversal : traversals == null ? List.<Traversal>of() : traversals) {
            if (traversal == null || traversal.traversalId() == null) {
                continue;
            }
            for (Long stairId : traversal.segmentRefs().stairIdsBySegmentKey().values()) {
                DungeonStair stair = stairId == null ? null : stairsById.get(stairId);
                if (stair != null) {
                    grouped.computeIfAbsent(traversal.traversalId(), ignored -> new ArrayList<>()).add(stair);
                }
            }
        }
        return grouped;
    }

    private static List<Corridor> corridorsForRoute(TraversalRoute route) {
        ArrayList<Corridor> result = new ArrayList<>();
        for (TraversalRoute.CorridorSegment corridorSegment : route == null
                ? List.<TraversalRoute.CorridorSegment>of()
                : route.corridorSegments()) {
            if (corridorSegment != null && corridorSegment.corridor() != null) {
                result.add(corridorSegment.corridor());
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<DungeonStair> stairsForRoute(TraversalRoute route) {
        ArrayList<DungeonStair> result = new ArrayList<>();
        for (TraversalRoute.StairSegment stairSegment : route == null
                ? List.<TraversalRoute.StairSegment>of()
                : route.stairSegments()) {
            if (stairSegment != null && stairSegment.stair() != null) {
                result.add(stairSegment.stair());
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<Corridor> unownedCorridors(List<Traversal> traversals, List<Corridor> corridors) {
        Set<Long> ownedCorridorIds = ownedCorridorIds(traversals);
        ArrayList<Corridor> result = new ArrayList<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null
                    && corridor.corridorId() != null
                    && !ownedCorridorIds.contains(corridor.corridorId())) {
                result.add(corridor);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<DungeonStair> unownedStairs(List<Traversal> traversals, List<DungeonStair> stairs) {
        Set<Long> ownedStairIds = ownedStairIds(traversals);
        ArrayList<DungeonStair> result = new ArrayList<>();
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair != null
                    && stair.stairId() != null
                    && !ownedStairIds.contains(stair.stairId())) {
                result.add(stair);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<Long> ownedCorridorIds(List<Traversal> traversals) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (Traversal traversal : traversals == null ? List.<Traversal>of() : traversals) {
            if (traversal != null) {
                result.addAll(traversal.segmentRefs().corridorIdsBySegmentKey().values());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<Long> ownedStairIds(List<Traversal> traversals) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (Traversal traversal : traversals == null ? List.<Traversal>of() : traversals) {
            if (traversal != null) {
                result.addAll(traversal.segmentRefs().stairIdsBySegmentKey().values());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Map<Long, Corridor> corridorsById(List<Corridor> corridors) {
        LinkedHashMap<Long, Corridor> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null && corridor.corridorId() != null) {
                result.putIfAbsent(corridor.corridorId(), corridor);
            }
        }
        return result;
    }

    private static Map<Long, DungeonStair> stairsById(List<DungeonStair> stairs) {
        LinkedHashMap<Long, DungeonStair> result = new LinkedHashMap<>();
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair != null && stair.stairId() != null) {
                result.putIfAbsent(stair.stairId(), stair);
            }
        }
        return result;
    }

}
