package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.model.interaction.DungeonHitKind;
import javafx.geometry.Point2D;

import java.util.Objects;

public final class DungeonHitConventions {

    public static final long CLUSTER_LABEL_PRIORITY = 100L;
    public static final long VERTEX_PRIORITY = 90L;
    public static final long CORRIDOR_NODE_PRIORITY = 80L;
    public static final long TRANSITION_PRIORITY = 75L;
    public static final long STAIR_PRIORITY = 74L;
    public static final long CORRIDOR_CORNER_PRIORITY = 70L;
    public static final long CORRIDOR_SEGMENT_PRIORITY = 60L;
    public static final long DOOR_PRIORITY = 50L;
    public static final long CONNECTION_PRIORITY = 50L;
    public static final long CORRIDOR_BOUNDARY_PRIORITY = 45L;
    public static final long ROOM_BOUNDARY_PRIORITY = 40L;
    public static final long ROOM_PRIORITY = 20L;
    public static final long CORRIDOR_TILE_PRIORITY = 18L;
    public static final long CORRIDOR_PRIORITY = 15L;
    public static final long ROOM_CELL_PRIORITY = 12L;
    public static final long FLOOR_CELL_PRIORITY = 10L;
    public static final long GRID_CELL_PRIORITY = 5L;

    private DungeonHitConventions() {
    }

    public static long basePriority(DungeonHitKind kind) {
        return switch (Objects.requireNonNull(kind, "kind")) {
            case CLUSTER_LABEL -> CLUSTER_LABEL_PRIORITY;
            case VERTEX -> VERTEX_PRIORITY;
            case CORRIDOR_NODE -> CORRIDOR_NODE_PRIORITY;
            case TRANSITION -> TRANSITION_PRIORITY;
            case STAIR -> STAIR_PRIORITY;
            case CORRIDOR_CORNER -> CORRIDOR_CORNER_PRIORITY;
            case CORRIDOR_SEGMENT -> CORRIDOR_SEGMENT_PRIORITY;
            case DOOR -> DOOR_PRIORITY;
            case CONNECTION -> CONNECTION_PRIORITY;
            case CORRIDOR_BOUNDARY -> CORRIDOR_BOUNDARY_PRIORITY;
            case ROOM_BOUNDARY -> ROOM_BOUNDARY_PRIORITY;
            case ROOM -> ROOM_PRIORITY;
            case CORRIDOR_TILE -> CORRIDOR_TILE_PRIORITY;
            case CORRIDOR -> CORRIDOR_PRIORITY;
            case ROOM_CELL -> ROOM_CELL_PRIORITY;
            case FLOOR_CELL -> FLOOR_CELL_PRIORITY;
            case GRID_CELL -> GRID_CELL_PRIORITY;
        };
    }

    public static double edgeTolerancePx(double gridSizePx) {
        if (!Double.isFinite(gridSizePx) || gridSizePx <= 0.0) {
            throw new IllegalArgumentException("gridSizePx must be finite and > 0");
        }
        return Math.max(7.0, gridSizePx * 0.22);
    }

    public static double pointTolerancePx(double gridSizePx) {
        if (!Double.isFinite(gridSizePx) || gridSizePx <= 0.0) {
            throw new IllegalArgumentException("gridSizePx must be finite and > 0");
        }
        return Math.max(8.0, gridSizePx * 0.28);
    }

    public static double labelDistancePx(Point2D canvasPoint, Point2D anchorPoint) {
        return Objects.requireNonNull(canvasPoint, "canvasPoint")
                .distance(Objects.requireNonNull(anchorPoint, "anchorPoint"));
    }
}
