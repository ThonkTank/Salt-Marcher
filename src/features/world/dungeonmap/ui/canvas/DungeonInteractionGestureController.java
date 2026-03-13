package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.BrushShape;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Consumer;

final class DungeonInteractionGestureController {

    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private final DungeonWallPathFinder wallPathFinder;

    private String lastDraggedCellKey;
    private String lastDraggedEdgeKey;
    private DungeonWallPathFinder.VertexRef activeWallPaintStart;
    private List<DungeonMapPane.EdgeInteraction> activeWallPaintPath = List.of();

    DungeonInteractionGestureController(
            DungeonCanvasModel model,
            DungeonViewport viewport,
            DungeonWallPathFinder wallPathFinder
    ) {
        this.model = model;
        this.viewport = viewport;
        this.wallPathFinder = wallPathFinder;
    }

    void resetDragState() {
        lastDraggedCellKey = null;
        lastDraggedEdgeKey = null;
    }

    void clearActiveWallPaintPath(Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathPreview) {
        activeWallPaintStart = null;
        activeWallPaintPath = List.of();
        if (onEdgePaintPathPreview != null) {
            onEdgePaintPathPreview.accept(List.of());
        }
    }

    void handlePaintAt(
            double screenX,
            double screenY,
            Consumer<DungeonMapPane.CellInteraction> onCellPainted,
            int brushSize,
            BrushShape brushShape
    ) {
        DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, screenX, screenY);
        if (interaction == null || onCellPainted == null) {
            return;
        }
        List<DungeonMapPane.CellInteraction> cells = brushCells(interaction.x(), interaction.y(), brushSize, brushShape);
        if (cells.size() == 1) {
            String cellKey = interaction.x() + ":" + interaction.y();
            if (!cellKey.equals(lastDraggedCellKey)) {
                lastDraggedCellKey = cellKey;
                onCellPainted.accept(cells.get(0));
            }
            return;
        }
        for (DungeonMapPane.CellInteraction cell : cells) {
            onCellPainted.accept(cell);
        }
        lastDraggedCellKey = interaction.x() + ":" + interaction.y();
    }

    void handleEdgeEraseAt(
            double screenX,
            double screenY,
            Consumer<DungeonMapPane.EdgeInteraction> onEdgePainted,
            BiFunction<Double, Double, DungeonMapPane.EdgeInteraction> edgeLocator
    ) {
        DungeonMapPane.EdgeInteraction interaction = edgeLocator.apply(screenX, screenY);
        if (interaction == null || onEdgePainted == null) {
            return;
        }
        String edgeKey = interaction.edge().edgeKey();
        if (edgeKey.equals(lastDraggedEdgeKey)) {
            return;
        }
        lastDraggedEdgeKey = edgeKey;
        onEdgePainted.accept(interaction);
    }

    void beginWallPaintPath(double screenX, double screenY, Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathPreview) {
        DungeonWallPathFinder.VertexRef vertex = wallPathFinder.findPaintVertexInSearchWindow(screenX, screenY);
        if (vertex == null) {
            clearActiveWallPaintPath(onEdgePaintPathPreview);
            return;
        }
        activeWallPaintStart = vertex;
        activeWallPaintPath = List.of();
        if (onEdgePaintPathPreview != null) {
            onEdgePaintPathPreview.accept(List.of());
        }
    }

    void updateWallPaintPath(double screenX, double screenY, Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathPreview) {
        if (activeWallPaintStart == null) {
            return;
        }
        DungeonWallPathFinder.VertexRef target = wallPathFinder.findPaintVertexInSearchWindow(screenX, screenY);
        if (target == null) {
            activeWallPaintPath = List.of();
            if (onEdgePaintPathPreview != null) {
                onEdgePaintPathPreview.accept(List.of());
            }
            return;
        }
        List<DungeonMapPane.EdgeInteraction> path = wallPathFinder.findWallPaintPath(activeWallPaintStart, target);
        activeWallPaintPath = path;
        if (onEdgePaintPathPreview != null) {
            onEdgePaintPathPreview.accept(path);
        }
    }

    void finishWallPaintPath(
            Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathPreview,
            Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathFinished
    ) {
        List<DungeonMapPane.EdgeInteraction> finishedPath = activeWallPaintPath;
        clearActiveWallPaintPath(onEdgePaintPathPreview);
        if (!finishedPath.isEmpty() && onEdgePaintPathFinished != null) {
            onEdgePaintPathFinished.accept(finishedPath);
        }
    }

    private List<DungeonMapPane.CellInteraction> brushCells(int centerX, int centerY, int brushSize, BrushShape brushShape) {
        int radius = brushSize - 1;
        if (radius == 0) {
            DungeonMapPane.CellInteraction single = cellAt(centerX, centerY);
            return single == null ? List.of() : List.of(single);
        }
        List<DungeonMapPane.CellInteraction> cells = new ArrayList<>();
        for (int dy = -radius; dy <= radius; dy++) {
            for (int dx = -radius; dx <= radius; dx++) {
                if (!inBrushShape(brushShape, dx, dy, radius)) {
                    continue;
                }
                DungeonMapPane.CellInteraction cell = cellAt(centerX + dx, centerY + dy);
                if (cell != null) {
                    cells.add(cell);
                }
            }
        }
        return cells;
    }

    private DungeonMapPane.CellInteraction cellAt(int x, int y) {
        if (model.state() == null || model.state().map() == null) {
            return null;
        }
        if (x < 0 || y < 0 || x >= model.state().map().width() || y >= model.state().map().height()) {
            return null;
        }
        return new DungeonMapPane.CellInteraction(x, y, model.squareAt(x, y));
    }

    private static boolean inBrushShape(BrushShape shape, int dx, int dy, int radius) {
        return switch (shape) {
            case SQUARE -> true;
            case CIRCLE -> dx * dx + dy * dy <= radius * radius;
            case DIAMOND -> Math.abs(dx) + Math.abs(dy) <= radius;
        };
    }
}
