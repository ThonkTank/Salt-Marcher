package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.DungeonCorridorGeometry;
import features.world.dungeonmap.model.DoorSegment;
import features.world.dungeonmap.model.DungeonRoomGeometry;
import features.world.dungeonmap.model.Point2i;

public final class DungeonCanvasBounds {

    private static final double DEFAULT_MIN_WORLD = -8.0;
    private static final double DEFAULT_MAX_WORLD = 8.0;
    private static final double WORLD_PADDING = 2.0;

    private final double minX;
    private final double maxX;
    private final double minY;
    private final double maxY;

    private DungeonCanvasBounds(double minX, double maxX, double minY, double maxY) {
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
    }

    public static DungeonCanvasBounds defaultBounds() {
        return new DungeonCanvasBounds(DEFAULT_MIN_WORLD, DEFAULT_MAX_WORLD, DEFAULT_MIN_WORLD, DEFAULT_MAX_WORLD);
    }

    public static DungeonCanvasBounds forLayout(DungeonLayout layout) {
        if (layout == null || layout.clusters() == null || layout.clusters().isEmpty()) {
            return defaultBounds();
        }
        double minX = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double minY = Double.POSITIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;
        for (var cluster : layout.clusters()) {
            for (java.util.List<Point2i> loop : DungeonRoomGeometry.absoluteLoops(cluster)) {
                for (Point2i point : loop) {
                    minX = Math.min(minX, point.x() - WORLD_PADDING);
                    maxX = Math.max(maxX, point.x() + WORLD_PADDING);
                    minY = Math.min(minY, point.y() - WORLD_PADDING);
                    maxY = Math.max(maxY, point.y() + WORLD_PADDING);
                }
            }
        }
        for (CorridorGeometry geometry : DungeonCorridorGeometry.corridorTopology(layout).corridorGeometries().values()) {
            for (Point2i cell : geometry.cells()) {
                minX = Math.min(minX, cell.x() - WORLD_PADDING);
                maxX = Math.max(maxX, cell.x() + 1 + WORLD_PADDING);
                minY = Math.min(minY, cell.y() - WORLD_PADDING);
                maxY = Math.max(maxY, cell.y() + 1 + WORLD_PADDING);
            }
            for (DoorSegment door : geometry.doors()) {
                minX = Math.min(minX, Math.min(door.start().x(), door.end().x()) - WORLD_PADDING);
                maxX = Math.max(maxX, Math.max(door.start().x(), door.end().x()) + WORLD_PADDING);
                minY = Math.min(minY, Math.min(door.start().y(), door.end().y()) - WORLD_PADDING);
                maxY = Math.max(maxY, Math.max(door.start().y(), door.end().y()) + WORLD_PADDING);
            }
        }
        if (!Double.isFinite(minX) || !Double.isFinite(maxX) || !Double.isFinite(minY) || !Double.isFinite(maxY)) {
            return defaultBounds();
        }
        return new DungeonCanvasBounds(minX, maxX, minY, maxY);
    }

    public double minX() {
        return minX;
    }

    public double maxX() {
        return maxX;
    }

    public double minY() {
        return minY;
    }

    public double maxY() {
        return maxY;
    }

    public double centerX() {
        return (minX + maxX) / 2.0;
    }

    public double centerY() {
        return (minY + maxY) / 2.0;
    }
}
