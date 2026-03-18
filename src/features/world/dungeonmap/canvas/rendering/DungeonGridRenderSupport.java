package features.world.dungeonmap.canvas.rendering;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.function.Function;

public final class DungeonGridRenderSupport {

    private DungeonGridRenderSupport() {
    }

    public static void drawGrid(
            GraphicsContext gc,
            int minWorldX,
            int maxWorldX,
            int minWorldY,
            int maxWorldY,
            double canvasWidth,
            double canvasHeight,
            DungeonGridScreenMath.ScreenPointResolver resolver
    ) {
        gc.setStroke(DungeonCanvasTheme.GRID_LINE);
        gc.setLineWidth(1);
        for (int x = minWorldX; x <= maxWorldX + 1; x++) {
            double screenX = resolver.screenX(x);
            gc.strokeLine(screenX, 0, screenX, canvasHeight);
        }
        for (int y = minWorldY; y <= maxWorldY + 1; y++) {
            double screenY = resolver.screenY(y);
            gc.strokeLine(0, screenY, canvasWidth, screenY);
        }
    }

    public static void drawRegion(
            GraphicsContext gc,
            Set<Point2i> cells,
            Color fill,
            Color stroke,
            double lineWidth,
            Set<Long> encodedOpenSegments,
            DungeonGridScreenMath.ScreenPointResolver resolver
    ) {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        if (fill != null) {
            gc.setFill(fill);
            for (Point2i cell : cells) {
                double x = resolver.screenX(cell.x());
                double y = resolver.screenY(cell.y());
                double width = resolver.screenX(cell.x() + 1) - x;
                double height = resolver.screenY(cell.y() + 1) - y;
                gc.fillRect(x, y, width, height);
            }
        }
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        Set<Long> encodedCells = encodeCells(cells);
        for (Point2i cell : cells) {
            int x = cell.x();
            int y = cell.y();
            if (!encodedCells.contains(DungeonGridScreenMath.encodeCell(x, y - 1))
                    && !encodedOpenSegments.contains(DungeonGridScreenMath.encodeSegment(x, y, x + 1, y))) {
                gc.strokeLine(resolver.screenX(x), resolver.screenY(y), resolver.screenX(x + 1), resolver.screenY(y));
            }
            if (!encodedCells.contains(DungeonGridScreenMath.encodeCell(x + 1, y))
                    && !encodedOpenSegments.contains(DungeonGridScreenMath.encodeSegment(x + 1, y, x + 1, y + 1))) {
                gc.strokeLine(resolver.screenX(x + 1), resolver.screenY(y), resolver.screenX(x + 1), resolver.screenY(y + 1));
            }
            if (!encodedCells.contains(DungeonGridScreenMath.encodeCell(x, y + 1))
                    && !encodedOpenSegments.contains(DungeonGridScreenMath.encodeSegment(x, y + 1, x + 1, y + 1))) {
                gc.strokeLine(resolver.screenX(x), resolver.screenY(y + 1), resolver.screenX(x + 1), resolver.screenY(y + 1));
            }
            if (!encodedCells.contains(DungeonGridScreenMath.encodeCell(x - 1, y))
                    && !encodedOpenSegments.contains(DungeonGridScreenMath.encodeSegment(x, y, x, y + 1))) {
                gc.strokeLine(resolver.screenX(x), resolver.screenY(y), resolver.screenX(x), resolver.screenY(y + 1));
            }
        }
    }

    public static void drawClusterEdges(
            GraphicsContext gc,
            DungeonLayout layout,
            Function<DungeonRoomCluster, DungeonGridScreenMath.ScreenPointResolver> resolverFactory
    ) {
        if (layout == null) {
            return;
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            DungeonGridScreenMath.ScreenPointResolver resolver = resolverFactory.apply(cluster);
            for (DungeonRoomCluster.EdgeOverride edge : cluster.edgeOverrides()) {
                Point2i start = edgeStart(edge);
                Point2i end = edgeEnd(edge);
                if (edge.type() == DungeonRoomCluster.EdgeType.WALL) {
                    gc.setStroke(DungeonCanvasTheme.ROOM_SELECTED_STROKE);
                    gc.setLineWidth(3);
                } else {
                    gc.setStroke(DungeonCanvasTheme.DOOR);
                    gc.setLineWidth(3);
                }
                gc.strokeLine(
                        resolver.screenX(start.x()),
                        resolver.screenY(start.y()),
                        resolver.screenX(end.x()),
                        resolver.screenY(end.y()));
            }
        }
    }

    public static ClusterAnchorLayout.AnchorPosition clusterAnchorPosition(
            ClusterAnchorLayout anchorLayout,
            DungeonGridScreenMath.ScreenPointResolver resolver
    ) {
        Point2i center = anchorLayout.clusterCenter();
        double x = resolver.screenX(center.x() + 0.5);
        double y = resolver.screenY(center.y() + 0.5);
        return new ClusterAnchorLayout.AnchorPosition(x, anchorLayout.clusterOverlapsRoom() ? y - 8 : y);
    }

    public static ClusterAnchorLayout.AnchorPosition roomAnchorPosition(
            ClusterAnchorLayout anchorLayout,
            DungeonRoom room,
            DungeonGridScreenMath.ScreenPointResolver resolver,
            double overlapOffset,
            double stackSpacing
    ) {
        ClusterAnchorLayout.RoomAnchorGroup roomGroup = anchorLayout.roomGroup(room);
        Point2i center = roomGroup == null ? anchorLayout.clusterCenter() : roomGroup.center();
        double x = resolver.screenX(center.x() + 0.5);
        double y = resolver.screenY(center.y() + 0.5);
        if (roomGroup == null || roomGroup.count() <= 1) {
            return new ClusterAnchorLayout.AnchorPosition(
                    x,
                    y + (roomGroup != null && roomGroup.overlapsCluster(anchorLayout.clusterCenter()) ? overlapOffset : 0));
        }
        double stackOffset = (roomGroup.index() - (roomGroup.count() - 1) / 2.0) * stackSpacing;
        if (roomGroup.overlapsCluster(anchorLayout.clusterCenter())) {
            stackOffset += overlapOffset;
        }
        return new ClusterAnchorLayout.AnchorPosition(x, y + stackOffset);
    }

    private static Set<Long> encodeCells(Set<Point2i> cells) {
        Set<Long> encoded = new LinkedHashSet<>();
        for (Point2i cell : cells) {
            encoded.add(DungeonGridScreenMath.encodeCell(cell));
        }
        return encoded;
    }

    private static Point2i edgeStart(DungeonRoomCluster.EdgeOverride edge) {
        Point2i cell = edge.cell();
        return switch (edge.direction()) {
            case NORTH -> new Point2i(cell.x(), cell.y());
            case EAST -> new Point2i(cell.x() + 1, cell.y());
            case SOUTH -> new Point2i(cell.x(), cell.y() + 1);
            case WEST -> new Point2i(cell.x(), cell.y());
        };
    }

    private static Point2i edgeEnd(DungeonRoomCluster.EdgeOverride edge) {
        Point2i cell = edge.cell();
        return switch (edge.direction()) {
            case NORTH -> new Point2i(cell.x() + 1, cell.y());
            case EAST -> new Point2i(cell.x() + 1, cell.y() + 1);
            case SOUTH -> new Point2i(cell.x() + 1, cell.y() + 1);
            case WEST -> new Point2i(cell.x(), cell.y() + 1);
        };
    }
}
