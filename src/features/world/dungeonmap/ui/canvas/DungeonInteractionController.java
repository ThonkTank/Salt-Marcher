package features.world.dungeonmap.ui.canvas;

import javafx.scene.canvas.Canvas;
import javafx.scene.input.MouseButton;

import java.util.function.Consumer;

final class DungeonInteractionController {

    private final Canvas selectionCanvas;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private final Runnable redrawAll;

    private boolean paintMode = false;
    private String lastDraggedCellKey;
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

    void setPaintMode(boolean paintMode) {
        this.paintMode = paintMode;
        lastDraggedCellKey = null;
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
                redrawAll.run();
                return;
            }
            if (paintMode && event.isPrimaryButtonDown()) {
                handlePaintAt(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseReleased(event -> {
            viewport.endPan();
            lastDraggedCellKey = null;
            if (paintMode && event.getButton() == MouseButton.PRIMARY && onPaintStrokeFinished != null) {
                onPaintStrokeFinished.run();
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
        String cellKey = interaction.x() + ":" + interaction.y();
        if (cellKey.equals(lastDraggedCellKey)) {
            return;
        }
        lastDraggedCellKey = cellKey;
        onCellPainted.accept(interaction);
    }
}
