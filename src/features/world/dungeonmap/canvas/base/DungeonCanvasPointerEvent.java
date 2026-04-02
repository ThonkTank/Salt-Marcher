package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.geometry.CellCoord;
import javafx.geometry.Point2D;
import javafx.scene.input.MouseButton;

public record DungeonCanvasPointerEvent(
        Point2D canvasPoint,
        CellCoord gridCell,
        DungeonCanvasCamera camera,
        MouseButton button,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        boolean middleButtonDown
) {
    public boolean isPrimaryButton() {
        return button == MouseButton.PRIMARY;
    }

    public boolean isSecondaryButton() {
        return button == MouseButton.SECONDARY;
    }

    public boolean isMiddleButton() {
        return button == MouseButton.MIDDLE;
    }

    public boolean isPrimaryButtonDown() {
        return primaryButtonDown;
    }

    public boolean isSecondaryButtonDown() {
        return secondaryButtonDown;
    }

    public boolean isMiddleButtonDown() {
        return middleButtonDown;
    }
}
