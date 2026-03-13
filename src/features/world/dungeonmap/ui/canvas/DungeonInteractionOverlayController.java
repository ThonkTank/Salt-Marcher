package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.editing.BrushShape;
import features.world.dungeonmap.model.domain.PassageDirection;
import features.world.dungeonmap.ui.editor.toolbar.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.toolbar.DungeonPaintMode;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.function.BiFunction;

final class DungeonInteractionOverlayController {

    private static final Color HOVER_PAINT_FILL = Color.web("#d9a030", 0.35);
    private static final Color HOVER_ERASE_FILL = Color.web("#e53935", 0.35);
    private static final Color HOVER_EDGE_STROKE = Color.web("#d9a030", 0.70);
    private static final Color HOVER_EDGE_ERASE_STROKE = Color.web("#e53935", 0.75);

    private final Canvas selectionCanvas;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private Runnable redrawSelection;

    private int hoverCellX = -1;
    private int hoverCellY = -1;
    private int hoverEdgeX = -1;
    private int hoverEdgeY = -1;
    private PassageDirection hoverEdgeDir;
    private int hoverVertexX = -1;
    private int hoverVertexY = -1;
    private CellRef selectionDragStart;
    private CellRef selectionDragCurrent;

    DungeonInteractionOverlayController(
            Canvas selectionCanvas,
            DungeonCanvasModel model,
            DungeonViewport viewport
    ) {
        this.selectionCanvas = selectionCanvas;
        this.model = model;
        this.viewport = viewport;
    }

    void setRedrawSelection(Runnable redrawSelection) {
        this.redrawSelection = redrawSelection;
    }

    void refreshForToolState(
            DungeonEditorTool activeTool,
            DungeonPaintMode paintMode,
            BrushShape brushShape,
            int brushSize,
            DungeonEdgeToolPolicy edgeToolPolicy
    ) {
        if (activeTool.isBrushTool()) {
            drawHover(activeTool, paintMode, brushShape, brushSize);
        } else {
            clearHover(activeTool, paintMode, brushShape, brushSize);
        }
        if (edgeToolPolicy.edgeHoverEnabled()) {
            drawEdgeHover(edgeToolPolicy);
        } else {
            clearEdgeHover(edgeToolPolicy);
        }
    }

    void beginSelectionDrag(double screenX, double screenY, DungeonEditorTool activeTool, DungeonPaintMode paintMode, BrushShape brushShape, int brushSize) {
        CellRef start = cellRefAt(screenX, screenY);
        if (start == null) {
            clearSelectionDrag(true, activeTool, paintMode, brushShape, brushSize);
            return;
        }
        selectionDragStart = start;
        selectionDragCurrent = start;
        drawHover(activeTool, paintMode, brushShape, brushSize);
    }

    void updateSelectionDrag(double screenX, double screenY, DungeonEditorTool activeTool, DungeonPaintMode paintMode, BrushShape brushShape, int brushSize) {
        if (selectionDragStart == null) {
            beginSelectionDrag(screenX, screenY, activeTool, paintMode, brushShape, brushSize);
            return;
        }
        CellRef current = cellRefAt(screenX, screenY);
        if (current == null || current.equals(selectionDragCurrent)) {
            return;
        }
        selectionDragCurrent = current;
        drawHover(activeTool, paintMode, brushShape, brushSize);
    }

    List<DungeonMapPane.CellInteraction> finishSelectionDrag(DungeonEditorTool activeTool, DungeonPaintMode paintMode, BrushShape brushShape, int brushSize) {
        List<DungeonMapPane.CellInteraction> cells = selectionCells(brushShape);
        clearSelectionDrag(true, activeTool, paintMode, brushShape, brushSize);
        return cells;
    }

    void updateHover(double screenX, double screenY, DungeonEditorTool activeTool, DungeonPaintMode paintMode, BrushShape brushShape, int brushSize) {
        DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, screenX, screenY);
        int newX = interaction == null ? -1 : interaction.x();
        int newY = interaction == null ? -1 : interaction.y();
        if (newX == hoverCellX && newY == hoverCellY) {
            return;
        }
        hoverCellX = newX;
        hoverCellY = newY;
        drawHover(activeTool, paintMode, brushShape, brushSize);
    }

    void clearHover(DungeonEditorTool activeTool, DungeonPaintMode paintMode, BrushShape brushShape, int brushSize) {
        hoverCellX = -1;
        hoverCellY = -1;
        drawHover(activeTool, paintMode, brushShape, brushSize);
    }

    void updateEdgeHover(
            double screenX,
            double screenY,
            DungeonEdgeToolPolicy edgeToolPolicy,
            DungeonWallPathFinder wallPathFinder,
            BiFunction<Double, Double, DungeonMapPane.EdgeInteraction> edgeLocator
    ) {
        if (edgeToolPolicy.usesWallPaintPath()) {
            DungeonWallPathFinder.VertexRef vertex = wallPathFinder.findPaintVertexInSearchWindow(screenX, screenY);
            int newVertexX = vertex == null ? -1 : vertex.x();
            int newVertexY = vertex == null ? -1 : vertex.y();
            if (newVertexX == hoverVertexX && newVertexY == hoverVertexY) {
                return;
            }
            hoverVertexX = newVertexX;
            hoverVertexY = newVertexY;
            hoverEdgeX = -1;
            hoverEdgeY = -1;
            hoverEdgeDir = null;
            drawEdgeHover(edgeToolPolicy);
            return;
        }
        hoverVertexX = -1;
        hoverVertexY = -1;
        DungeonMapPane.EdgeInteraction interaction = edgeLocator.apply(screenX, screenY);
        int newX = interaction == null ? -1 : interaction.edge().x();
        int newY = interaction == null ? -1 : interaction.edge().y();
        PassageDirection newDir = interaction == null ? null : interaction.edge().direction();
        if (newX == hoverEdgeX && newY == hoverEdgeY && newDir == hoverEdgeDir) {
            return;
        }
        hoverEdgeX = newX;
        hoverEdgeY = newY;
        hoverEdgeDir = newDir;
        drawEdgeHover(edgeToolPolicy);
    }

    void clearEdgeHover(DungeonEdgeToolPolicy edgeToolPolicy) {
        hoverEdgeX = -1;
        hoverEdgeY = -1;
        hoverEdgeDir = null;
        hoverVertexX = -1;
        hoverVertexY = -1;
        drawEdgeHover(edgeToolPolicy);
    }

    void clearSelectionDrag(boolean redraw, DungeonEditorTool activeTool, DungeonPaintMode paintMode, BrushShape brushShape, int brushSize) {
        if (selectionDragStart == null && selectionDragCurrent == null) {
            return;
        }
        selectionDragStart = null;
        selectionDragCurrent = null;
        if (redraw) {
            drawHover(activeTool, paintMode, brushShape, brushSize);
        }
    }

    private void drawHover(DungeonEditorTool activeTool, DungeonPaintMode paintMode, BrushShape brushShape, int brushSize) {
        GraphicsContext gc = selectionCanvas.getGraphicsContext2D();
        gc.clearRect(0, 0, selectionCanvas.getWidth(), selectionCanvas.getHeight());
        if (redrawSelection != null) {
            redrawSelection.run();
        }
        List<DungeonMapPane.CellInteraction> previewCells = hoverPreviewCells(activeTool, paintMode, brushShape, brushSize);
        if (previewCells.isEmpty()) {
            return;
        }
        gc.setFill(activeTool == DungeonEditorTool.ERASE ? HOVER_ERASE_FILL : HOVER_PAINT_FILL);
        double cellSize = viewport.scaledCellSize();
        for (DungeonMapPane.CellInteraction cell : previewCells) {
            gc.fillRect(viewport.screenX(cell.x()), viewport.screenY(cell.y()), cellSize - 1, cellSize - 1);
        }
    }

    private void drawEdgeHover(DungeonEdgeToolPolicy edgeToolPolicy) {
        GraphicsContext gc = selectionCanvas.getGraphicsContext2D();
        gc.clearRect(0, 0, selectionCanvas.getWidth(), selectionCanvas.getHeight());
        if (redrawSelection != null) {
            redrawSelection.run();
        }
        if (edgeToolPolicy.usesWallPaintPath() && hoverVertexX >= 0 && hoverVertexY >= 0) {
            gc.setFill(HOVER_EDGE_STROKE);
            double radius = Math.max(4.0, 5.0 * viewport.strokeScale());
            double centerX = viewport.screenX(hoverVertexX);
            double centerY = viewport.screenY(hoverVertexY);
            gc.fillOval(centerX - radius, centerY - radius, radius * 2.0, radius * 2.0);
            return;
        }
        if (hoverEdgeX < 0 || hoverEdgeDir == null) {
            return;
        }
        gc.setStroke(edgeToolPolicy.destructiveHover() ? HOVER_EDGE_ERASE_STROKE : HOVER_EDGE_STROKE);
        gc.setLineWidth(Math.max(3.0, 5.0 * viewport.strokeScale()));
        strokeEdge(gc, hoverEdgeX, hoverEdgeY, hoverEdgeDir);
    }

    private List<DungeonMapPane.CellInteraction> hoverPreviewCells(
            DungeonEditorTool activeTool,
            DungeonPaintMode paintMode,
            BrushShape brushShape,
            int brushSize
    ) {
        if (activeTool.isBrushTool() && paintMode == DungeonPaintMode.SELECTION) {
            if (selectionDragStart != null && selectionDragCurrent != null) {
                return selectionCells(brushShape);
            }
            if (hoverCellX < 0 || hoverCellY < 0) {
                return List.of();
            }
            DungeonMapPane.CellInteraction hoveredCell = cellAt(hoverCellX, hoverCellY);
            return hoveredCell == null ? List.of() : List.of(hoveredCell);
        }
        if (hoverCellX < 0 || hoverCellY < 0) {
            return List.of();
        }
        return brushCells(hoverCellX, hoverCellY, brushSize, brushShape);
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

    private List<DungeonMapPane.CellInteraction> selectionCells(BrushShape brushShape) {
        if (selectionDragStart == null || selectionDragCurrent == null) {
            return List.of();
        }
        int minX = Math.min(selectionDragStart.x(), selectionDragCurrent.x());
        int maxX = Math.max(selectionDragStart.x(), selectionDragCurrent.x());
        int minY = Math.min(selectionDragStart.y(), selectionDragCurrent.y());
        int maxY = Math.max(selectionDragStart.y(), selectionDragCurrent.y());
        LinkedHashMap<String, DungeonMapPane.CellInteraction> cells = new LinkedHashMap<>();
        for (int y = minY; y <= maxY; y++) {
            for (int x = minX; x <= maxX; x++) {
                if (!inSelectionShape(brushShape, x, y, minX, minY, maxX, maxY)) {
                    continue;
                }
                DungeonMapPane.CellInteraction cell = cellAt(x, y);
                if (cell != null) {
                    cells.put(x + ":" + y, cell);
                }
            }
        }
        return List.copyOf(cells.values());
    }

    private CellRef cellRefAt(double screenX, double screenY) {
        DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, screenX, screenY);
        return interaction == null ? null : new CellRef(interaction.x(), interaction.y());
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

    private static boolean inSelectionShape(BrushShape shape, int x, int y, int minX, int minY, int maxX, int maxY) {
        return switch (shape) {
            case SQUARE -> true;
            case CIRCLE -> inEllipse(x, y, minX, minY, maxX, maxY);
            case DIAMOND -> inDiamond(x, y, minX, minY, maxX, maxY);
        };
    }

    private static boolean inEllipse(int x, int y, int minX, int minY, int maxX, int maxY) {
        double centerX = (minX + maxX) / 2.0;
        double centerY = (minY + maxY) / 2.0;
        double radiusX = Math.max(0.5, (maxX - minX + 1) / 2.0);
        double radiusY = Math.max(0.5, (maxY - minY + 1) / 2.0);
        double normalizedX = (x + 0.5 - centerX) / radiusX;
        double normalizedY = (y + 0.5 - centerY) / radiusY;
        return normalizedX * normalizedX + normalizedY * normalizedY <= 1.0;
    }

    private static boolean inDiamond(int x, int y, int minX, int minY, int maxX, int maxY) {
        double centerX = (minX + maxX) / 2.0;
        double centerY = (minY + maxY) / 2.0;
        double radiusX = Math.max(0.5, (maxX - minX + 1) / 2.0);
        double radiusY = Math.max(0.5, (maxY - minY + 1) / 2.0);
        double normalizedX = Math.abs(x + 0.5 - centerX) / radiusX;
        double normalizedY = Math.abs(y + 0.5 - centerY) / radiusY;
        return normalizedX + normalizedY <= 1.0;
    }

    private void strokeEdge(GraphicsContext gc, int x, int y, PassageDirection dir) {
        if (dir == PassageDirection.EAST) {
            double sx = viewport.screenX(x + 1);
            double sy = viewport.screenY(y);
            double ey = viewport.screenY(y + 1);
            gc.strokeLine(sx, sy, sx, ey);
            return;
        }
        double sx = viewport.screenX(x);
        double sy = viewport.screenY(y + 1);
        double ex = viewport.screenX(x + 1);
        gc.strokeLine(sx, sy, ex, sy);
    }

    private record CellRef(int x, int y) {
    }
}
