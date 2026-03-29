package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairGeometry;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

// Eine Treppe, die der Traversal-Planer platziert hat. Public, da sie Traversal-Materialisierung verlässt.
public record TraversalStairPlacement(
        Point2i anchor,
        StairShape shape,
        CardinalDirection direction,
        int dimension1,
        int dimension2,
        List<Integer> exitLevels,
        Set<CubePoint> footprint
) {
    public TraversalStairPlacement {
        exitLevels = exitLevels == null ? List.of() : List.copyOf(exitLevels);
        footprint = footprint == null ? Set.of() : Set.copyOf(footprint);
    }

    public StairGeometry geometry() {
        if (exitLevels.size() < 2) {
            throw new IllegalArgumentException("Stair placement requires at least two exit levels");
        }
        return StairGeometry.fromExitLevels(
                shape,
                anchor,
                direction,
                dimension1,
                dimension2,
                exitLevels);
    }

    public DungeonStair materialize(
            Long stairId,
            Long traversalId,
            String segmentKey,
            long mapId
    ) {
        try {
            StairGeometry geometry = geometry();
            return new DungeonStair(
                    stairId,
                    traversalId,
                    segmentKey,
                    mapId,
                    geometry.pathNodes(),
                    geometry.exits());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    static List<TraversalStairPlacement> canonicalize(List<TraversalStairPlacement> placements) {
        if (placements == null || placements.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalStairPlacement> result = new ArrayList<>();
        for (TraversalStairPlacement placement : placements) {
            if (placement == null) {
                continue;
            }
            if (result.isEmpty()) {
                result.add(placement);
                continue;
            }
            TraversalStairPlacement merged = tryMerge(result.getLast(), placement);
            if (merged != null) {
                result.set(result.size() - 1, merged);
                continue;
            }
            result.add(placement);
        }
        return List.copyOf(result);
    }

    private static TraversalStairPlacement tryMerge(TraversalStairPlacement first, TraversalStairPlacement second) {
        if (first == null || second == null
                || first.shape() != second.shape()
                || first.direction() != second.direction()
                || first.dimension1() != second.dimension1()
                || first.dimension2() != second.dimension2()) {
            return null;
        }
        LinkedHashSet<Integer> mergedLevels = new LinkedHashSet<>(first.exitLevels());
        mergedLevels.addAll(second.exitLevels());
        LinkedHashSet<CubePoint> mergedFootprint = new LinkedHashSet<>(first.footprint());
        mergedFootprint.addAll(second.footprint());
        Point2i anchor = inferAnchor(mergedFootprint);
        if (anchor == null) {
            return null;
        }
        StairGeometry mergedGeometry;
        try {
            mergedGeometry = StairGeometry.fromExitLevels(
                    first.shape(),
                    anchor,
                    first.direction(),
                    first.dimension1(),
                    first.dimension2(),
                    List.copyOf(mergedLevels));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
        if (!mergedGeometry.occupiedPositions().equals(Set.copyOf(mergedFootprint))) {
            return null;
        }
        return new TraversalStairPlacement(
                anchor,
                first.shape(),
                first.direction(),
                first.dimension1(),
                first.dimension2(),
                mergedGeometry.exits().stream()
                        .map(exit -> exit.position().z())
                        .toList(),
                mergedGeometry.occupiedPositions());
    }

    private static Point2i inferAnchor(Set<CubePoint> footprint) {
        if (footprint == null || footprint.isEmpty()) {
            return null;
        }
        CubePoint anchorPoint = footprint.stream()
                .filter(point -> point != null)
                .min(CubePoint.POINT_ORDER)
                .orElse(null);
        return anchorPoint == null ? null : anchorPoint.projectedCell();
    }
}
