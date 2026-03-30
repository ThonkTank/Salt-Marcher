package features.world.dungeonmap.model.structures.traversal.routing.internal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;

final class AutomaticStairVariantCatalog {

    private AutomaticStairVariantCatalog() {
        throw new AssertionError("No instances");
    }

    static List<StairVariant> variantsFor(
            CardinalDirection direction,
            int minZ,
            int maxZ
    ) {
        if (direction == null || maxZ < minZ) {
            return List.of();
        }
        int height = maxZ - minZ + 1;
        LinkedHashMap<VariantKey, StairVariant> bestVariantByKey = new LinkedHashMap<>();
        for (StairShape shape : automaticShapes()) {
            for (StairDimensions dimensions : dimensionsFor(shape, height)) {
                List<CubePoint> templatePath;
                try {
                    templatePath = StairPathGenerator.generatePath(
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
                if (templatePath.isEmpty()) {
                    continue;
                }
                StairVariant candidate = StairVariant.of(
                        shape,
                        direction,
                        dimensions.dimension1(),
                        dimensions.dimension2(),
                        templatePath);
                VariantKey key = new VariantKey(candidate.startOffset(), candidate.endOffset());
                StairVariant currentBest = bestVariantByKey.get(key);
                if (currentBest == null || isBetterProfile(candidate, currentBest)) {
                    bestVariantByKey.put(key, candidate);
                }
            }
        }
        ArrayList<StairVariant> result = new ArrayList<>(bestVariantByKey.values());
        result.sort(Comparator
                .comparingInt(StairVariant::profileSize)
                .thenComparingInt(StairVariant::profileArea)
                .thenComparingInt(variant -> shapePriority(variant.shape()))
                .thenComparingInt(StairVariant::dimension1)
                .thenComparingInt(StairVariant::dimension2)
                .thenComparing(StairVariant::startOffset, Point2i.POINT_ORDER)
                .thenComparing(StairVariant::endOffset, Point2i.POINT_ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<StairShape> automaticShapes() {
        ArrayList<StairShape> result = new ArrayList<>();
        for (StairShape shape : StairShape.values()) {
            if (shape != StairShape.LADDER) {
                result.add(shape);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<StairDimensions> dimensionsFor(StairShape shape, int height) {
        if (shape == null || height <= 0) {
            return List.of();
        }
        if (shape == StairShape.STRAIGHT) {
            return List.of(new StairDimensions(0, 0));
        }
        int maxDimension = Math.max(1, height - 1);
        ArrayList<StairDimensions> result = new ArrayList<>();
        if (shape == StairShape.SQUARE) {
            for (int sideLength = 1; sideLength <= maxDimension; sideLength++) {
                result.add(new StairDimensions(sideLength, 0));
            }
            return List.copyOf(result);
        }
        if (shape == StairShape.RECTANGULAR) {
            for (int width = 1; width <= maxDimension; width++) {
                for (int depth = 1; depth <= maxDimension; depth++) {
                    if (width != depth) {
                        result.add(new StairDimensions(width, depth));
                    }
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
        if (shape == StairShape.CIRCULAR) {
            for (int radius = 1; radius <= maxDimension; radius++) {
                result.add(new StairDimensions(radius, 0));
            }
            return List.copyOf(result);
        }
        return List.of();
    }

    private static boolean isBetterProfile(StairVariant candidate, StairVariant currentBest) {
        if (candidate.profileSize() != currentBest.profileSize()) {
            return candidate.profileSize() < currentBest.profileSize();
        }
        if (candidate.profileArea() != currentBest.profileArea()) {
            return candidate.profileArea() < currentBest.profileArea();
        }
        if (shapePriority(candidate.shape()) != shapePriority(currentBest.shape())) {
            return shapePriority(candidate.shape()) < shapePriority(currentBest.shape());
        }
        if (candidate.dimension1() != currentBest.dimension1()) {
            return candidate.dimension1() < currentBest.dimension1();
        }
        return candidate.dimension2() < currentBest.dimension2();
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

    private record StairDimensions(
            int dimension1,
            int dimension2
    ) {
    }

    private record VariantKey(
            Point2i startOffset,
            Point2i endOffset
    ) {
    }

    record StairVariant(
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<CubePoint> templatePath,
            Point2i startOffset,
            Point2i endOffset,
            int profileSize,
            int profileArea
    ) {
        StairVariant {
            templatePath = templatePath == null ? List.of() : List.copyOf(templatePath);
        }

        private static StairVariant of(
                StairShape shape,
                CardinalDirection direction,
                int dimension1,
                int dimension2,
                List<CubePoint> templatePath
        ) {
            LinkedHashSet<Point2i> projectedFootprint = new LinkedHashSet<>();
            for (CubePoint point : templatePath == null ? List.<CubePoint>of() : templatePath) {
                if (point != null) {
                    projectedFootprint.add(point.projectedCell());
                }
            }
            Point2i startOffset = templatePath == null || templatePath.isEmpty()
                    ? new Point2i(0, 0)
                    : templatePath.getFirst().projectedCell();
            Point2i endOffset = templatePath == null || templatePath.isEmpty()
                    ? new Point2i(0, 0)
                    : templatePath.getLast().projectedCell();
            return new StairVariant(
                    shape,
                    direction,
                    dimension1,
                    dimension2,
                    templatePath,
                    startOffset,
                    endOffset,
                    projectedFootprint.size(),
                    profileArea(projectedFootprint));
        }

        Point2i placementAnchorForLowerTerminal(Point2i lowerTerminal) {
            return lowerTerminal == null ? null : lowerTerminal.subtract(startOffset);
        }

        Point2i placementAnchorForUpperTerminal(Point2i upperTerminal) {
            return upperTerminal == null ? null : upperTerminal.subtract(endOffset);
        }

        List<CubePoint> placeAt(Point2i anchor) {
            if (anchor == null || templatePath.isEmpty()) {
                return List.of();
            }
            ArrayList<CubePoint> result = new ArrayList<>(templatePath.size());
            for (CubePoint point : templatePath) {
                result.add(CubePoint.at(point.projectedCell().add(anchor), point.z()));
            }
            return List.copyOf(result);
        }

        int stairPathLength() {
            return templatePath.size();
        }

        private static int profileArea(Iterable<Point2i> projectedFootprint) {
            int minX = Integer.MAX_VALUE;
            int minY = Integer.MAX_VALUE;
            int maxX = Integer.MIN_VALUE;
            int maxY = Integer.MIN_VALUE;
            for (Point2i point : projectedFootprint) {
                if (point == null) {
                    continue;
                }
                minX = Math.min(minX, point.x());
                minY = Math.min(minY, point.y());
                maxX = Math.max(maxX, point.x());
                maxY = Math.max(maxY, point.y());
            }
            if (minX == Integer.MAX_VALUE) {
                return 0;
            }
            return (maxX - minX + 1) * (maxY - minY + 1);
        }
    }
}
