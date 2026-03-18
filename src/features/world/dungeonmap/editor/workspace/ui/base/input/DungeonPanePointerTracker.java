package features.world.dungeonmap.editor.workspace.ui.base.input;

public final class DungeonPanePointerTracker {
    private double lastPointerScreenX;
    private double lastPointerScreenY;
    private boolean pointerInsideCanvas;

    public double lastPointerScreenX() {
        return lastPointerScreenX;
    }

    public double lastPointerScreenY() {
        return lastPointerScreenY;
    }

    public boolean pointerInsideCanvas() {
        return pointerInsideCanvas;
    }

    public void updatePointerPosition(double x, double y) {
        pointerInsideCanvas = true;
        lastPointerScreenX = x;
        lastPointerScreenY = y;
    }

    public void clearPointerState() {
        pointerInsideCanvas = false;
    }
}
