package features.world.dungeonmap.ui.workspace.workflow.state;

import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;

public final class DungeonPaneInteractionState {
    private Point2i selectionStartCell;
    private Point2i selectionEndCell;
    private Point2i paintStartCell;
    private Point2i paintEndCell;
    private double lastPointerScreenX;
    private double lastPointerScreenY;
    private boolean pointerInsideCanvas;
    private PointerInteraction pointerInteraction = IdleInteraction.INSTANCE;

    public Point2i selectionStartCell() {
        return selectionStartCell;
    }

    public void setSelectionStartCell(Point2i selectionStartCell) {
        this.selectionStartCell = selectionStartCell;
    }

    public Point2i selectionEndCell() {
        return selectionEndCell;
    }

    public void setSelectionEndCell(Point2i selectionEndCell) {
        this.selectionEndCell = selectionEndCell;
    }

    public Point2i paintStartCell() {
        return paintStartCell;
    }

    public void setPaintStartCell(Point2i paintStartCell) {
        this.paintStartCell = paintStartCell;
    }

    public Point2i paintEndCell() {
        return paintEndCell;
    }

    public void setPaintEndCell(Point2i paintEndCell) {
        this.paintEndCell = paintEndCell;
    }

    public double lastPointerScreenX() {
        return lastPointerScreenX;
    }

    public void setLastPointerScreenX(double lastPointerScreenX) {
        this.lastPointerScreenX = lastPointerScreenX;
    }

    public double lastPointerScreenY() {
        return lastPointerScreenY;
    }

    public void setLastPointerScreenY(double lastPointerScreenY) {
        this.lastPointerScreenY = lastPointerScreenY;
    }

    public boolean pointerInsideCanvas() {
        return pointerInsideCanvas;
    }

    public void setPointerInsideCanvas(boolean pointerInsideCanvas) {
        this.pointerInsideCanvas = pointerInsideCanvas;
    }

    public PointerInteraction pointerInteraction() {
        return pointerInteraction;
    }

    public void setPointerInteraction(PointerInteraction pointerInteraction) {
        this.pointerInteraction = pointerInteraction == null ? IdleInteraction.INSTANCE : pointerInteraction;
    }

    public void clearSelection() {
        selectionStartCell = null;
        selectionEndCell = null;
    }

    public void clearPaint() {
        paintStartCell = null;
        paintEndCell = null;
    }

    public sealed interface PointerInteraction
            permits IdleInteraction, PanInteraction, SelectionInteraction, PaintInteraction, DragInteraction,
            GraphCreateInteraction, GraphDeleteInteraction {
    }

    public enum IdleInteraction implements PointerInteraction {
        INSTANCE
    }

    public static final class PanInteraction implements PointerInteraction {
    }

    public record SelectionInteraction(Point2i anchorWorld) implements PointerInteraction {
    }

    public record PaintInteraction() implements PointerInteraction {
    }

    public record DragInteraction(
            DungeonRoomCluster cluster,
            Point2i originalCenter,
            double anchorWorldX,
            double anchorWorldY
    ) implements PointerInteraction {
    }

    public record GraphCreateInteraction(Point2i world) implements PointerInteraction {
    }

    public record GraphDeleteInteraction(DungeonRoomCluster cluster) implements PointerInteraction {
    }
}
