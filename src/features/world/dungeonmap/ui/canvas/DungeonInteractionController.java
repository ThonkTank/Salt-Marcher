package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.BrushShape;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseButton;
import javafx.scene.paint.Color;

import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonInteractionController {

    private static final Color HOVER_PAINT_FILL = Color.web("#d9a030", 0.35);
    private static final Color HOVER_ERASE_FILL = Color.web("#e53935", 0.35);

    private final Canvas selectionCanvas;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private final Runnable redrawAll;
    private Runnable redrawSelection;

    private boolean paintMode = false;
    private boolean eraseMode = false;
    private boolean handMode = false;
    private String lastDraggedCellKey;
    private int hoverCellX = -1;
    private int hoverCellY = -1;
    private int brushSize = 1;
    private Supplier<Integer> brushSizeSupplier;
    private Supplier<BrushShape> brushShapeSupplier;
    private Consumer<DungeonMapPane.CellInteraction> onCellClicked;
    private Consumer<DungeonMapPane.CellInteraction> onCellPainted;
    private Runnable onPaintStrokeFinished;

    DungeonInteractionController(
            Canvas selectionCanvas,
            DungeonCanvasModel model,
            DungeonViewport viewport,
            Runnable redrawAll
    ) {
        this.selectionCanvas = selectionCanvas;
        this.model = model;
        this.viewport = viewport;
        this.redrawAll = redrawAll;
        bind();
    }

    void setRedrawSelection(Runnable redrawSelection) {
        this.redrawSelection = redrawSelection;
    }

    void setPaintMode(boolean paintMode) {
        this.paintMode = paintMode;
        lastDraggedCellKey = null;
        if (!paintMode) {
            clearHover();
        }
        updateCursor();
    }

    void setEraseMode(boolean eraseMode) {
        this.eraseMode = eraseMode;
        if (!eraseMode) {
            clearHover();
        }
        updateCursor();
    }

    void setHandMode(boolean handMode) {
        this.handMode = handMode;
        updateCursor();
    }

    void setBrushSizeSupplier(Supplier<Integer> supplier) {
        this.brushSizeSupplier = supplier;
    }

    void setBrushShapeSupplier(Supplier<BrushShape> supplier) {
        this.brushShapeSupplier = supplier;
    }

    void setOnCellClicked(Consumer<DungeonMapPane.CellInteraction> onCellClicked) {
        this.onCellClicked = onCellClicked;
    }

    void setOnCellPainted(Consumer<DungeonMapPane.CellInteraction> onCellPainted) {
        this.onCellPainted = onCellPainted;
    }

    void setOnPaintStrokeFinished(Runnable onPaintStrokeFinished) {
        this.onPaintStrokeFinished = onPaintStrokeFinished;
    }

    private void bind() {
        selectionCanvas.setOnScroll(event -> {
            viewport.zoomAt(event.getX(), event.getY(), event.getDeltaY());
            redrawAll.run();
            event.consume();
        });
        selectionCanvas.setOnMousePressed(event -> {
            if (event.getButton() == MouseButton.SECONDARY) {
                viewport.startPan(event.getX(), event.getY());
                return;
            }
            if (event.getButton() == MouseButton.PRIMARY && paintMode) {
                handlePaintAt(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseDragged(event -> {
            if (viewport.isPanning()) {
                viewport.panTo(event.getX(), event.getY());
                clearHover();
                redrawAll.run();
                return;
            }
            if (paintMode && event.isPrimaryButtonDown()) {
                handlePaintAt(event.getX(), event.getY());
            }
            if (paintMode) {
                updateHover(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseReleased(event -> {
            viewport.endPan();
            lastDraggedCellKey = null;
            if (paintMode && event.getButton() == MouseButton.PRIMARY && onPaintStrokeFinished != null) {
                onPaintStrokeFinished.run();
            }
        });
        selectionCanvas.setOnMouseMoved(event -> {
            if (paintMode) {
                updateHover(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseExited(event -> {
            if (paintMode) {
                clearHover();
            }
        });
        selectionCanvas.setOnMouseClicked(event -> {
            if (paintMode || event.getButton() != MouseButton.PRIMARY || !event.isStillSincePress()) {
                return;
            }
            DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, event.getX(), event.getY());
            if (interaction != null && onCellClicked != null) {
                onCellClicked.accept(interaction);
            }
        });
    }

    private void handlePaintAt(double screenX, double screenY) {
        DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, screenX, screenY);
        if (interaction == null || onCellPainted == null) {
            return;
        }
        int size = currentBrushSize();
        int radius = size - 1;
        if (radius == 0) {
            String cellKey = interaction.x() + ":" + interaction.y();
            if (!cellKey.equals(lastDraggedCellKey)) {
                lastDraggedCellKey = cellKey;
                onCellPainted.accept(interaction);
            }
        } else {
            BrushShape shape = currentBrushShape();
            for (int dy = -radius; dy <= radius; dy++) {
                for (int dx = -radius; dx <= radius; dx++) {
                    if (!inShape(shape, dx, dy, radius)) continue;
                    DungeonMapPane.CellInteraction shifted =
                            model.interactionAt(viewport,
                                    viewport.screenCenterX(interaction.x() + dx),
                                    viewport.screenCenterY(interaction.y() + dy));
                    if (shifted != null) {
                        onCellPainted.accept(shifted);
                    }
                }
            }
            lastDraggedCellKey = interaction.x() + ":" + interaction.y();
        }
    }

    private void updateHover(double screenX, double screenY) {
        DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, screenX, screenY);
        int newX = interaction == null ? -1 : interaction.x();
        int newY = interaction == null ? -1 : interaction.y();
        if (newX == hoverCellX && newY == hoverCellY) {
            return;
        }
        hoverCellX = newX;
        hoverCellY = newY;
        drawHover();
    }

    private void clearHover() {
        hoverCellX = -1;
        hoverCellY = -1;
        drawHover();
    }

    private void drawHover() {
        GraphicsContext gc = selectionCanvas.getGraphicsContext2D();
        gc.clearRect(0, 0, selectionCanvas.getWidth(), selectionCanvas.getHeight());
        // Restore selection rect after clearing the canvas
        if (redrawSelection != null) {
            redrawSelection.run();
        }
        if (hoverCellX < 0 || hoverCellY < 0) {
            return;
        }
        Color fill = eraseMode ? HOVER_ERASE_FILL : HOVER_PAINT_FILL;
        gc.setFill(fill);
        int size = currentBrushSize();
        int radius = size - 1;
        double cellSize = viewport.scaledCellSize();
        BrushShape shape = currentBrushShape();
        for (int dy = -radius; dy <= radius; dy++) {
            for (int dx = -radius; dx <= radius; dx++) {
                if (!inShape(shape, dx, dy, radius)) continue;
                int cx = hoverCellX + dx;
                int cy = hoverCellY + dy;
                if (model.interactionAt(viewport, viewport.screenCenterX(cx), viewport.screenCenterY(cy)) != null) {
                    gc.fillRect(viewport.screenX(cx), viewport.screenY(cy), cellSize - 1, cellSize - 1);
                }
            }
        }
    }

    private void updateCursor() {
        if (paintMode && !eraseMode) {
            selectionCanvas.setCursor(javafx.scene.Cursor.CROSSHAIR);
        } else if (eraseMode) {
            selectionCanvas.setCursor(javafx.scene.Cursor.DISAPPEAR);
        } else if (handMode) {
            selectionCanvas.setCursor(javafx.scene.Cursor.HAND);
        } else {
            selectionCanvas.setCursor(javafx.scene.Cursor.DEFAULT);
        }
    }

    private int currentBrushSize() {
        if (brushSizeSupplier != null) {
            Integer val = brushSizeSupplier.get();
            if (val != null) {
                return val;
            }
        }
        return brushSize;
    }

    private BrushShape currentBrushShape() {
        if (brushShapeSupplier != null) {
            BrushShape shape = brushShapeSupplier.get();
            if (shape != null) return shape;
        }
        return BrushShape.SQUARE;
    }

    private static boolean inShape(BrushShape shape, int dx, int dy, int radius) {
        return switch (shape) {
            case SQUARE -> true;
            case CIRCLE -> dx * dx + dy * dy <= radius * radius;
            case DIAMOND -> Math.abs(dx) + Math.abs(dy) <= radius;
        };
    }
}
