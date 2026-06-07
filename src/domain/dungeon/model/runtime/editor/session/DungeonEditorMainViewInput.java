package src.domain.dungeon.model.runtime.editor.session;

public final class DungeonEditorMainViewInput {
    private final double canvasX;
    private final double canvasY;
    private final boolean primaryButtonDown;
    private final boolean secondaryButtonDown;
    private final boolean wallSingleClickMode;
    private final DungeonEditorMainViewPointerTarget target;

    public DungeonEditorMainViewInput(
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            boolean wallSingleClickMode,
            DungeonEditorMainViewPointerTarget target
    ) {
        this.canvasX = canvasX;
        this.canvasY = canvasY;
        this.primaryButtonDown = primaryButtonDown;
        this.secondaryButtonDown = secondaryButtonDown;
        this.wallSingleClickMode = wallSingleClickMode;
        this.target = target == null ? DungeonEditorMainViewPointerTarget.empty() : target;
    }

    public static DungeonEditorMainViewInput empty() {
        return new DungeonEditorMainViewInput(0.0, 0.0, false, false, false, DungeonEditorMainViewPointerTarget.empty());
    }

    public double canvasX() {
        return canvasX;
    }

    public double canvasY() {
        return canvasY;
    }

    public boolean primaryButtonDown() {
        return primaryButtonDown;
    }

    public boolean secondaryButtonDown() {
        return secondaryButtonDown;
    }

    public boolean wallSingleClickMode() {
        return wallSingleClickMode;
    }

    public DungeonEditorMainViewPointerTarget target() {
        return target;
    }
}
