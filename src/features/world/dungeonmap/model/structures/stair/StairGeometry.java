package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record StairGeometry(
        List<CubePoint> pathNodes,
        List<DungeonStairExit> exits
) {

    public record StairSpecification(
            Point2i anchor,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) {
        public StairSpecification {
            anchor = anchor == null ? new Point2i(0, 0) : anchor;
            shape = shape == null ? StairShape.LADDER : shape;
            direction = direction == null ? CardinalDirection.defaultDirection() : direction;
            exitLevels = exitLevels == null ? List.of() : List.copyOf(exitLevels);
        }
    }

    public StairGeometry {
        pathNodes = pathNodes == null ? List.of() : List.copyOf(pathNodes);
        exits = exits == null ? List.of() : List.copyOf(exits);
    }

    public static StairGeometry fromStair(DungeonStair stair) {
        if (stair == null) {
            return new StairGeometry(List.of(), List.of());
        }
        return fromExitLevels(
                stair.shape(),
                stair.anchor(),
                stair.direction(),
                stair.dimension1(),
                stair.dimension2(),
                stair.exitLevels());
    }

    public static StairGeometry fromExitLevels(
            StairShape shape,
            Point2i anchor,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) {
        List<Integer> sortedExitLevels = validateAndSortExitLevels(exitLevels);
        List<CubePoint> pathNodes = StairPathGenerator.generatePath(
                requireShape(shape),
                anchor,
                requireDirection(direction),
                sortedExitLevels.getFirst(),
                sortedExitLevels.getLast(),
                dimension1,
                dimension2);
        Map<Integer, CubePoint> pathPointByLevel = new LinkedHashMap<>();
        for (CubePoint node : pathNodes) {
            pathPointByLevel.put(node.z(), node);
        }
        ArrayList<DungeonStairExit> exits = new ArrayList<>();
        for (Integer level : sortedExitLevels) {
            CubePoint exitPoint = pathPointByLevel.get(level);
            if (exitPoint == null) {
                throw new IllegalArgumentException("Treppenpfad deckt Ebene z=" + level + " nicht ab");
            }
            exits.add(new DungeonStairExit(0L, exitPoint, "Ebene z=" + level));
        }
        return new StairGeometry(List.copyOf(pathNodes), List.copyOf(exits));
    }

    public static StairSpecification inferSpecification(
            List<CubePoint> pathNodes,
            List<DungeonStairExit> exits
    ) {
        List<CubePoint> normalizedPath = normalizePath(pathNodes);
        List<DungeonStairExit> normalizedExits = normalizeExits(exits);
        if (normalizedPath.isEmpty()) {
            throw new IllegalArgumentException("Treppenpfad fehlt");
        }
        List<Integer> exitLevels = validateAndSortExitLevels(normalizedExits.stream()
                .map(exit -> exit.position().z())
                .toList());
        int minZ = normalizedPath.getFirst().z();
        int maxZ = normalizedPath.getLast().z();
        if (normalizedPath.size() != maxZ - minZ + 1) {
            throw new IllegalArgumentException("Treppenpfad muss jede Ebene zwischen Start und Ende belegen");
        }
        Point2i start = normalizedPath.getFirst().projectedCell();
        ArrayList<StairSpecificationCandidate> candidates = new ArrayList<>();
        for (StairShape shape : StairShape.values()) {
            for (CardinalDirection direction : candidateDirections(shape)) {
                for (Dimensions dimensions : candidateDimensions(shape, maxZ - minZ + 1)) {
                    List<CubePoint> template;
                    try {
                        template = StairPathGenerator.generatePath(
                                shape,
                                new Point2i(0, 0),
                                direction,
                                minZ,
                                maxZ,
                                dimensions.dimension1(),
                                dimensions.dimension2());
                    } catch (IllegalArgumentException ignored) {
                        continue;
                    }
                    if (template.isEmpty() || template.size() != normalizedPath.size()) {
                        continue;
                    }
                    Point2i anchor = start.subtract(template.getFirst().projectedCell());
                    StairGeometry geometry;
                    try {
                        geometry = fromExitLevels(shape, anchor, direction, dimensions.dimension1(), dimensions.dimension2(), exitLevels);
                    } catch (IllegalArgumentException ignored) {
                        continue;
                    }
                    if (!geometry.pathNodes().equals(normalizedPath)) {
                        continue;
                    }
                    if (!exitPositions(geometry.exits()).equals(exitPositions(normalizedExits))) {
                        continue;
                    }
                    candidates.add(new StairSpecificationCandidate(
                            new StairSpecification(anchor, shape, direction, dimensions.dimension1(), dimensions.dimension2(), exitLevels),
                            shapePriority(shape),
                            dimensions.dimension1(),
                            dimensions.dimension2(),
                            direction.ordinal()));
                }
            }
        }
        if (candidates.isEmpty()) {
            throw new IllegalArgumentException("Treppenspezifikation konnte nicht aus der Geometrie rekonstruiert werden");
        }
        candidates.sort(StairSpecificationCandidate.ORDER);
        return candidates.getFirst().specification();
    }

    public Set<CubePoint> occupiedPositions() {
        LinkedHashSet<CubePoint> occupied = new LinkedHashSet<>(pathNodes);
        for (DungeonStairExit exit : exits) {
            if (exit != null && exit.position() != null) {
                occupied.add(exit.position());
            }
        }
        return Set.copyOf(occupied);
    }

    private static List<Integer> validateAndSortExitLevels(List<Integer> exitLevels) {
        ArrayList<Integer> result = new ArrayList<>();
        for (Integer level : exitLevels == null ? List.<Integer>of() : exitLevels) {
            if (level != null) {
                result.add(level);
            }
        }
        if (result.size() < 2) {
            throw new IllegalArgumentException("Mindestens zwei verschiedene Ebenen");
        }
        if (result.stream().distinct().count() != result.size()) {
            throw new IllegalArgumentException("Ausgänge dürfen nicht doppelt sein");
        }
        result.sort(Integer::compareTo);
        return List.copyOf(result);
    }

    private static StairShape requireShape(StairShape shape) {
        if (shape == null) {
            throw new IllegalArgumentException("Treppenform fehlt");
        }
        return shape;
    }

    private static CardinalDirection requireDirection(CardinalDirection direction) {
        if (direction == null) {
            throw new IllegalArgumentException("Treppenrichtung fehlt");
        }
        return direction;
    }

    private static List<CubePoint> normalizePath(List<CubePoint> pathNodes) {
        return (pathNodes == null ? List.<CubePoint>of() : pathNodes).stream()
                .filter(java.util.Objects::nonNull)
                .sorted(Comparator.comparingInt(CubePoint::z)
                        .thenComparingInt(CubePoint::x)
                        .thenComparingInt(CubePoint::y))
                .toList();
    }

    private static List<DungeonStairExit> normalizeExits(List<DungeonStairExit> exits) {
        return (exits == null ? List.<DungeonStairExit>of() : exits).stream()
                .filter(java.util.Objects::nonNull)
                .sorted(Comparator.comparingInt(exit -> exit.position().z()))
                .toList();
    }

    private static Set<CubePoint> exitPositions(List<DungeonStairExit> exits) {
        LinkedHashSet<CubePoint> positions = new LinkedHashSet<>();
        for (DungeonStairExit exit : exits == null ? List.<DungeonStairExit>of() : exits) {
            if (exit != null && exit.position() != null) {
                positions.add(exit.position());
            }
        }
        return Set.copyOf(positions);
    }

    private static List<CardinalDirection> candidateDirections(StairShape shape) {
        if (shape == StairShape.LADDER) {
            return List.of(CardinalDirection.defaultDirection());
        }
        return List.of(CardinalDirection.values());
    }

    private static List<Dimensions> candidateDimensions(StairShape shape, int height) {
        if (shape == null || height <= 0) {
            return List.of();
        }
        if (shape == StairShape.LADDER || shape == StairShape.STRAIGHT) {
            return List.of(new Dimensions(0, 0));
        }
        int maxDimension = Math.max(1, height - 1);
        ArrayList<Dimensions> result = new ArrayList<>();
        if (shape == StairShape.SQUARE) {
            for (int sideLength = 1; sideLength <= maxDimension; sideLength++) {
                result.add(new Dimensions(sideLength, 0));
            }
            return List.copyOf(result);
        }
        if (shape == StairShape.RECTANGULAR) {
            for (int width = 1; width <= maxDimension; width++) {
                for (int depth = 1; depth <= maxDimension; depth++) {
                    if (width != depth) {
                        result.add(new Dimensions(width, depth));
                    }
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
        if (shape == StairShape.CIRCULAR) {
            for (int radius = 1; radius <= maxDimension; radius++) {
                result.add(new Dimensions(radius, 0));
            }
            return List.copyOf(result);
        }
        return List.of();
    }

    private static int shapePriority(StairShape shape) {
        return switch (shape) {
            case STRAIGHT -> 0;
            case SQUARE -> 1;
            case RECTANGULAR -> 2;
            case CIRCULAR -> 3;
            case LADDER -> 4;
        };
    }

    private record Dimensions(
            int dimension1,
            int dimension2
    ) {
    }

    private record StairSpecificationCandidate(
            StairSpecification specification,
            int shapePriority,
            int dimension1,
            int dimension2,
            int directionPriority
    ) {
        private static final Comparator<StairSpecificationCandidate> ORDER = Comparator
                .comparingInt(StairSpecificationCandidate::shapePriority)
                .thenComparingInt(StairSpecificationCandidate::dimension1)
                .thenComparingInt(StairSpecificationCandidate::dimension2)
                .thenComparingInt(StairSpecificationCandidate::directionPriority)
                .thenComparing(candidate -> candidate.specification().anchor(), Point2i.POINT_ORDER);
    }
}
