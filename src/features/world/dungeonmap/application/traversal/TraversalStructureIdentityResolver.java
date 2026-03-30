package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class TraversalStructureIdentityResolver {

    private TraversalStructureIdentityResolver() {
    }

    public static TraversalRoute apply(TraversalRoute traversalRoute, TraversalSegmentRefs segmentRefs) {
        TraversalSegmentRefs resolvedSegmentRefs = segmentRefs == null ? TraversalSegmentRefs.empty() : segmentRefs;
        return apply(
                traversalRoute,
                resolvedSegmentRefs.corridorIdsBySegmentKey(),
                resolvedSegmentRefs.stairIdsBySegmentKey());
    }

    public static TraversalRoute apply(
            TraversalRoute traversalRoute,
            Map<String, Long> corridorIdsBySegmentKey,
            Map<String, Long> stairIdsBySegmentKey
    ) {
        TraversalRoute sourceRoute = traversalRoute == null ? TraversalRoute.empty() : traversalRoute;
        if (sourceRoute.isEmpty()) {
            return sourceRoute;
        }
        Map<String, Long> resolvedCorridorIds = corridorIdsBySegmentKey == null ? Map.of() : Map.copyOf(corridorIdsBySegmentKey);
        Map<String, Long> resolvedStairIds = stairIdsBySegmentKey == null ? Map.of() : Map.copyOf(stairIdsBySegmentKey);
        if (resolvedCorridorIds.isEmpty() && resolvedStairIds.isEmpty()) {
            return sourceRoute;
        }
        return new TraversalRoute(
                bindCorridorSegments(sourceRoute.corridorSegments(), resolvedCorridorIds),
                bindStairSegments(sourceRoute.stairSegments(), resolvedStairIds));
    }

    private static List<TraversalRoute.CorridorSegment> bindCorridorSegments(
            List<TraversalRoute.CorridorSegment> corridorSegments,
            Map<String, Long> corridorIdsBySegmentKey
    ) {
        if (corridorSegments == null || corridorSegments.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalRoute.CorridorSegment> rebound = new ArrayList<>();
        for (TraversalRoute.CorridorSegment corridorSegment : corridorSegments) {
            if (corridorSegment == null || corridorSegment.corridor() == null) {
                continue;
            }
            Corridor corridor = corridorSegment.corridor();
            Long corridorId = corridorIdsBySegmentKey.get(corridorSegment.segmentKey());
            Corridor resolvedCorridor = corridorId == null ? corridor : corridor.withIdentity(corridorId, corridor.mapId());
            rebound.add(new TraversalRoute.CorridorSegment(corridorSegment.segmentKey(), resolvedCorridor));
        }
        return rebound.isEmpty() ? List.of() : List.copyOf(rebound);
    }

    private static List<TraversalRoute.StairSegment> bindStairSegments(
            List<TraversalRoute.StairSegment> stairSegments,
            Map<String, Long> stairIdsBySegmentKey
    ) {
        if (stairSegments == null || stairSegments.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalRoute.StairSegment> rebound = new ArrayList<>();
        for (TraversalRoute.StairSegment stairSegment : stairSegments) {
            if (stairSegment == null || stairSegment.stair() == null) {
                continue;
            }
            DungeonStair stair = stairSegment.stair();
            Long stairId = stairIdsBySegmentKey.get(stairSegment.segmentKey());
            DungeonStair resolvedStair = stairId == null ? stair : stair.withIdentity(stairId, stair.mapId());
            rebound.add(new TraversalRoute.StairSegment(stairSegment.segmentKey(), resolvedStair));
        }
        return rebound.isEmpty() ? List.of() : List.copyOf(rebound);
    }
}
