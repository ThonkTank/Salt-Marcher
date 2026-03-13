package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.BrushShape;
import features.world.dungeonmap.model.DungeonEdgeSummary;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.DungeonPaintMode;
import features.world.dungeonmap.ui.editor.controls.PassageEditorMode;
import features.world.dungeonmap.ui.editor.controls.WallEditorMode;
import javafx.scene.canvas.Canvas;
import javafx.scene.input.MouseButton;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonInteractionController {

    private final Canvas selectionCanvas;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private final Runnable redrawAll;
    private final DungeonWallPathFinder wallPathFinder;
    private final DungeonInteractionOverlayController overlayController;
    private final DungeonInteractionGestureController gestureController;

    private DungeonEditorTool activeTool = DungeonEditorTool.SELECT;
    private Supplier<Integer> brushSizeSupplier;
    private Supplier<BrushShape> brushShapeSupplier;
    private Supplier<DungeonPaintMode> paintModeSupplier;
    private Supplier<WallEditorMode> wallEditorModeSupplier;
    private Supplier<PassageEditorMode> passageEditorModeSupplier;
    private Consumer<DungeonMapPane.CellInteraction> onCellClicked;
    private Consumer<DungeonMapPane.CellInteraction> onCellPainted;
    private Runnable onPaintStrokeFinished;
    private Consumer<DungeonMapPane.EdgeInteraction> onEdgeClicked;
    private Consumer<DungeonMapPane.EdgeInteraction> onEdgePainted;
    private Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathPreview;
    private Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathFinished;
    private Runnable onEdgeStrokeFinished;

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
        this.wallPathFinder = new DungeonWallPathFinder(model, viewport);
        this.overlayController = new DungeonInteractionOverlayController(selectionCanvas, model, viewport);
        this.gestureController = new DungeonInteractionGestureController(model, viewport, wallPathFinder);
        bind();
    }

    void setRedrawSelection(Runnable redrawSelection) {
        overlayController.setRedrawSelection(redrawSelection);
    }

    void setActiveTool(DungeonEditorTool activeTool) {
        this.activeTool = activeTool == null ? DungeonEditorTool.SELECT : activeTool;
        gestureController.resetDragState();
        overlayController.clearSelectionDrag(false, this.activeTool, currentPaintMode(), currentBrushShape(), currentBrushSize());
        gestureController.clearActiveWallPaintPath(onEdgePaintPathPreview);
        overlayController.refreshForToolState(
                this.activeTool,
                currentPaintMode(),
                currentBrushShape(),
                currentBrushSize(),
                currentEdgeToolPolicy());
        updateCursor();
    }

    void setOnEdgeClicked(Consumer<DungeonMapPane.EdgeInteraction> onEdgeClicked) {
        this.onEdgeClicked = onEdgeClicked;
    }

    void setBrushSizeSupplier(Supplier<Integer> supplier) {
        this.brushSizeSupplier = supplier;
    }

    void setBrushShapeSupplier(Supplier<BrushShape> supplier) {
        this.brushShapeSupplier = supplier;
    }

    void setPaintModeSupplier(Supplier<DungeonPaintMode> supplier) {
        this.paintModeSupplier = supplier;
    }

    void setWallEditorModeSupplier(Supplier<WallEditorMode> supplier) {
        this.wallEditorModeSupplier = supplier;
    }

    void setPassageEditorModeSupplier(Supplier<PassageEditorMode> supplier) {
        this.passageEditorModeSupplier = supplier;
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

    void setOnEdgePainted(Consumer<DungeonMapPane.EdgeInteraction> onEdgePainted) {
        this.onEdgePainted = onEdgePainted;
    }

    void setOnEdgePaintPathPreview(Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathPreview) {
        this.onEdgePaintPathPreview = onEdgePaintPathPreview;
    }

    void setOnEdgePaintPathFinished(Consumer<List<DungeonMapPane.EdgeInteraction>> onEdgePaintPathFinished) {
        this.onEdgePaintPathFinished = onEdgePaintPathFinished;
    }

    void setOnEdgeStrokeFinished(Runnable onEdgeStrokeFinished) {
        this.onEdgeStrokeFinished = onEdgeStrokeFinished;
    }

    private void bind() {
        selectionCanvas.setOnScroll(event -> {
            viewport.zoomAt(event.getX(), event.getY(), event.getDeltaY());
            redrawAll.run();
            event.consume();
        });
        selectionCanvas.setOnMousePressed(event -> {
            if (event.getButton() == MouseButton.SECONDARY) {
                overlayController.clearSelectionDrag(true, activeTool, currentPaintMode(), currentBrushShape(), currentBrushSize());
                viewport.startPan(event.getX(), event.getY());
                return;
            }
            if (event.getButton() == MouseButton.PRIMARY && usesSelectionPaint()) {
                overlayController.beginSelectionDrag(
                        event.getX(),
                        event.getY(),
                        activeTool,
                        currentPaintMode(),
                        currentBrushShape(),
                        currentBrushSize());
            } else if (event.getButton() == MouseButton.PRIMARY && activeTool.isBrushTool()) {
                gestureController.handlePaintAt(
                        event.getX(),
                        event.getY(),
                        onCellPainted,
                        currentBrushSize(),
                        currentBrushShape());
            } else if (event.getButton() == MouseButton.PRIMARY && currentEdgeToolPolicy().usesWallPaintPath()) {
                gestureController.beginWallPaintPath(event.getX(), event.getY(), onEdgePaintPathPreview);
            } else if (event.getButton() == MouseButton.PRIMARY && currentEdgeToolPolicy().usesWallEraseDrag()) {
                gestureController.handleEdgeEraseAt(event.getX(), event.getY(), onEdgePainted, this::interactionAt);
            }
        });
        selectionCanvas.setOnMouseDragged(event -> {
            if (viewport.isPanning()) {
                viewport.panTo(event.getX(), event.getY());
                overlayController.clearHover(activeTool, currentPaintMode(), currentBrushShape(), currentBrushSize());
                redrawAll.run();
                return;
            }
            if (usesSelectionPaint() && event.isPrimaryButtonDown()) {
                overlayController.updateSelectionDrag(
                        event.getX(),
                        event.getY(),
                        activeTool,
                        currentPaintMode(),
                        currentBrushShape(),
                        currentBrushSize());
            } else if (activeTool.isBrushTool() && event.isPrimaryButtonDown()) {
                gestureController.handlePaintAt(
                        event.getX(),
                        event.getY(),
                        onCellPainted,
                        currentBrushSize(),
                        currentBrushShape());
            }
            if (currentEdgeToolPolicy().usesWallPaintPath() && event.isPrimaryButtonDown()) {
                gestureController.updateWallPaintPath(event.getX(), event.getY(), onEdgePaintPathPreview);
            } else if (currentEdgeToolPolicy().usesWallEraseDrag() && event.isPrimaryButtonDown()) {
                gestureController.handleEdgeEraseAt(event.getX(), event.getY(), onEdgePainted, this::interactionAt);
            }
            if (activeTool.isBrushTool()) {
                overlayController.updateHover(
                        event.getX(),
                        event.getY(),
                        activeTool,
                        currentPaintMode(),
                        currentBrushShape(),
                        currentBrushSize());
            } else if (edgeHoverEnabled()) {
                overlayController.updateEdgeHover(event.getX(), event.getY(), currentEdgeToolPolicy(), wallPathFinder, this::interactionAt);
            }
        });
        selectionCanvas.setOnMouseReleased(event -> {
            viewport.endPan();
            gestureController.resetDragState();
            if (event.getButton() == MouseButton.PRIMARY) {
                if (usesSelectionPaint()) {
                    List<DungeonMapPane.CellInteraction> cells = overlayController.finishSelectionDrag(
                            activeTool,
                            currentPaintMode(),
                            currentBrushShape(),
                            currentBrushSize());
                    if (!cells.isEmpty() && onCellPainted != null) {
                        for (DungeonMapPane.CellInteraction cell : cells) {
                            onCellPainted.accept(cell);
                        }
                        if (onPaintStrokeFinished != null) {
                            onPaintStrokeFinished.run();
                        }
                    }
                } else if (activeTool.isBrushTool() && onPaintStrokeFinished != null) {
                    onPaintStrokeFinished.run();
                }
            }
            if (event.getButton() == MouseButton.PRIMARY && currentEdgeToolPolicy().usesWallPaintPath()) {
                gestureController.finishWallPaintPath(onEdgePaintPathPreview, onEdgePaintPathFinished);
                if (onEdgeStrokeFinished != null) {
                    onEdgeStrokeFinished.run();
                }
            } else if (event.getButton() == MouseButton.PRIMARY
                    && currentEdgeToolPolicy().usesWallEraseDrag()
                    && onEdgeStrokeFinished != null) {
                onEdgeStrokeFinished.run();
            }
        });
        selectionCanvas.setOnMouseMoved(event -> {
            if (activeTool.isBrushTool()) {
                overlayController.updateHover(
                        event.getX(),
                        event.getY(),
                        activeTool,
                        currentPaintMode(),
                        currentBrushShape(),
                        currentBrushSize());
            } else if (edgeHoverEnabled()) {
                overlayController.updateEdgeHover(event.getX(), event.getY(), currentEdgeToolPolicy(), wallPathFinder, this::interactionAt);
            }
        });
        selectionCanvas.setOnMouseExited(event -> {
            if (usesSelectionPaint()) {
                overlayController.clearSelectionDrag(true, activeTool, currentPaintMode(), currentBrushShape(), currentBrushSize());
            }
            if (activeTool.isBrushTool()) {
                overlayController.clearHover(activeTool, currentPaintMode(), currentBrushShape(), currentBrushSize());
            } else if (edgeHoverEnabled()) {
                overlayController.clearEdgeHover(currentEdgeToolPolicy());
            }
        });
        selectionCanvas.setOnMouseClicked(event -> {
            if (event.getButton() != MouseButton.PRIMARY || !event.isStillSincePress()) {
                return;
            }
            if (currentEdgeToolPolicy().usesPassageClick()) {
                handleEdgeClick(event.getX(), event.getY());
                return;
            }
            if (currentEdgeToolPolicy().edgeHoverEnabled()) {
                return;
            }
            if (activeTool.isBrushTool()) {
                return;
            }
            DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, event.getX(), event.getY());
            if (interaction != null && onCellClicked != null) {
                onCellClicked.accept(interaction);
            }
        });
    }

    private void handleEdgeClick(double screenX, double screenY) {
        DungeonMapPane.EdgeInteraction interaction = interactionAt(screenX, screenY);
        if (interaction == null || onEdgeClicked == null) {
            return;
        }
        onEdgeClicked.accept(interaction);
    }

    private DungeonMapPane.EdgeInteraction interactionAt(double screenX, double screenY) {
        int[] edge = findEdgeAt(screenX, screenY);
        if (edge == null) {
            return null;
        }
        PassageDirection dir = edge[2] == 0 ? PassageDirection.EAST : PassageDirection.SOUTH;
        DungeonEdgeSummary edgeSummary = model.edgeAt(dir.edgeKey(edge[0], edge[1]));
        if (!currentEdgeToolPolicy().allowsInteraction(edgeSummary)) {
            if (!currentEdgeToolPolicy().edgeHoverEnabled()) {
                return null;
            }
            if (currentEdgeToolPolicy().interactionMode() != DungeonEdgeToolPolicy.EdgeInteractionMode.NONE) {
                return null;
            }
        }
        return edgeSummary == null ? null : new DungeonMapPane.EdgeInteraction(edgeSummary);
    }

    private int[] findEdgeAt(double screenX, double screenY) {
        if (model.state() == null || model.state().map() == null) {
            return null;
        }
        double cellSize = viewport.scaledCellSize();
        double fx = (screenX - viewport.screenX(0)) / cellSize;
        double fy = (screenY - viewport.screenY(0)) / cellSize;
        int cx = (int) Math.floor(fx);
        int cy = (int) Math.floor(fy);
        double rx = fx - cx;
        double ry = fy - cy;

        int canonX;
        int canonY;
        PassageDirection dir;
        if (rx < ry && rx < 1.0 - ry) {
            canonX = cx - 1;
            canonY = cy;
            dir = PassageDirection.EAST;
        } else if (rx > ry && rx > 1.0 - ry) {
            canonX = cx;
            canonY = cy;
            dir = PassageDirection.EAST;
        } else if (ry < rx && ry < 1.0 - rx) {
            canonX = cx;
            canonY = cy - 1;
            dir = PassageDirection.SOUTH;
        } else {
            canonX = cx;
            canonY = cy;
            dir = PassageDirection.SOUTH;
        }

        DungeonEdgeSummary edge = model.edgeAt(dir.edgeKey(canonX, canonY));
        if (edge == null || !edge.hasInteractiveContext()) {
            return null;
        }
        return new int[]{canonX, canonY, dir == PassageDirection.EAST ? 0 : 1};
    }

    private void updateCursor() {
        selectionCanvas.setCursor(activeTool.cursor());
    }

    private boolean edgeHoverEnabled() {
        return currentEdgeToolPolicy().edgeHoverEnabled();
    }

    private boolean usesSelectionPaint() {
        return activeTool.isBrushTool() && currentPaintMode() == DungeonPaintMode.SELECTION;
    }

    private DungeonEdgeToolPolicy currentEdgeToolPolicy() {
        return DungeonEdgeToolPolicy.resolve(activeTool, currentWallEditorMode(), currentPassageEditorMode());
    }

    private WallEditorMode currentWallEditorMode() {
        if (wallEditorModeSupplier != null) {
            WallEditorMode mode = wallEditorModeSupplier.get();
            if (mode != null) {
                return mode;
            }
        }
        return WallEditorMode.PAINT_WALL;
    }

    private PassageEditorMode currentPassageEditorMode() {
        if (passageEditorModeSupplier != null) {
            PassageEditorMode mode = passageEditorModeSupplier.get();
            if (mode != null) {
                return mode;
            }
        }
        return PassageEditorMode.PLACE_PASSAGE;
    }

    private int currentBrushSize() {
        if (brushSizeSupplier != null) {
            Integer value = brushSizeSupplier.get();
            if (value != null) {
                return value;
            }
        }
        return 1;
    }

    private BrushShape currentBrushShape() {
        if (brushShapeSupplier != null) {
            BrushShape shape = brushShapeSupplier.get();
            if (shape != null) {
                return shape;
            }
        }
        return BrushShape.SQUARE;
    }

    private DungeonPaintMode currentPaintMode() {
        if (paintModeSupplier != null) {
            DungeonPaintMode mode = paintModeSupplier.get();
            if (mode != null) {
                return mode;
            }
        }
        return DungeonPaintMode.BRUSH;
    }
}
