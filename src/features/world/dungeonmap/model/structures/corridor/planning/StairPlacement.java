package features.world.dungeonmap.model.structures.corridor.planning;

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

// Eine Treppe, die der Pathfinder platziert hat. Public, da sie Traversal-Materialisierung verlässt.
public record StairPlacement(
        Point2i anchor,
        StairShape shape,
        CardinalDirection direction,
        int dimension1,
        int dimension2,
        List<Integer> exitLevels,
        Set<CubePoint> footprint
) {
    public StairPlacement {
        exitLevels = exitLevels == null ? List.of() : List.copyOf(exitLevels);
        footprint = footprint == null ? Set.of() : Set.copyOf(footprint);
    }

    public DungeonStair toPreviewStair(long mapId, Long traversalId) {
        if (exitLevels.size() < 2) {
            return null;
        }
        try {
            StairGeometry geometry = StairGeometry.fromExitLevels(
                    shape,
                    anchor,
                    direction,
                    dimension1,
                    dimension2,
                    exitLevels);
            return new DungeonStair(
                    null,
                    traversalId,
                    "preview-stair",
                    mapId,
                    null,
                    shape,
                    direction,
                    dimension1,
                    dimension2,
                    geometry.pathNodes(),
                    geometry.exits());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    static List<StairPlacement> canonicalize(List<StairPlacement> placements) {
        if (placements == null || placements.isEmpty()) {
            return List.of();
        }
        ArrayList<StairPlacement> result = new ArrayList<>();
        for (StairPlacement placement : placements) {
            if (placement == null) {
                continue;
            }
            if (result.isEmpty()) {
                result.add(placement);
                continue;
            }
            StairPlacement merged = tryMerge(result.getLast(), placement);
            if (merged != null) {
                result.set(result.size() - 1, merged);
                continue;
            }
            result.add(placement);
        }
        return List.copyOf(result);
    }

    private static StairPlacement tryMerge(StairPlacement first, StairPlacement second) {
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
        return new StairPlacement(
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
