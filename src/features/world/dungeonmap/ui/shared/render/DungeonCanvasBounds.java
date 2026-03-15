package features.world.dungeonmap.ui.shared.render;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.service.DungeonGeometry;

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
        if (layout == null || layout.rooms() == null || layout.rooms().isEmpty()) {
            return defaultBounds();
        }
        double minX = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double minY = Double.POSITIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;
        for (DungeonRoom room : layout.rooms()) {
            for (Point2i point : DungeonGeometry.absolutePolygon(room)) {
                minX = Math.min(minX, point.x() - WORLD_PADDING);
                maxX = Math.max(maxX, point.x() + WORLD_PADDING);
                minY = Math.min(minY, point.y() - WORLD_PADDING);
                maxY = Math.max(maxY, point.y() + WORLD_PADDING);
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
