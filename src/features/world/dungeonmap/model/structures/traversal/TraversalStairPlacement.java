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
import java.util.Objects;
import java.util.Set;

// Traversal carries placement metadata only; canonical stair identity and materialization live on DungeonStair.
public record TraversalStairPlacement(
        DungeonStair stair,
        Set<CubePoint> footprint
) {
    public TraversalStairPlacement {
        stair = Objects.requireNonNull(stair, "stair");
        footprint = footprint == null ? Set.of() : Set.copyOf(footprint);
    }

    public Point2i anchor() {
        return stair.anchor();
    }

    public StairShape shape() {
        return stair.shape();
    }

    public CardinalDirection direction() {
        return stair.direction();
    }

    public int dimension1() {
        return stair.dimension1();
    }

    public int dimension2() {
        return stair.dimension2();
    }

    public List<Integer> exitLevels() {
        return stair.exitLevels();
    }

    public StairGeometry geometry() {
        return stair.geometry();
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
        if (!Objects.equals(first.anchor(), second.anchor())) {
            return null;
        }
        StairGeometry mergedGeometry;
        try {
            mergedGeometry = StairGeometry.fromExitLevels(
                    first.shape(),
                    first.anchor(),
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
                DungeonStair.planned(
                        first.anchor(),
                        first.shape(),
                        first.direction(),
                        first.dimension1(),
                        first.dimension2(),
                        mergedGeometry.exits().stream()
                                .map(exit -> exit.position().z())
                                .toList()),
                mergedGeometry.occupiedPositions());
    }
}
