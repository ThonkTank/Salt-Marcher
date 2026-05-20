package src.domain.dungeon.model.editor.model.session.model;

public final class DungeonEditorMainViewInput {
    private final double canvasX;
    private final double canvasY;
    private final boolean primaryButtonDown;
    private final boolean secondaryButtonDown;
    private final DungeonEditorMainViewPointerTarget target;

    public DungeonEditorMainViewInput(
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            DungeonEditorMainViewPointerTarget target
    ) {
        this.canvasX = canvasX;
        this.canvasY = canvasY;
        this.primaryButtonDown = primaryButtonDown;
        this.secondaryButtonDown = secondaryButtonDown;
        this.target = target == null ? DungeonEditorMainViewPointerTarget.empty() : target;
    }

    public static DungeonEditorMainViewInput empty() {
        return new DungeonEditorMainViewInput(0.0, 0.0, false, false, DungeonEditorMainViewPointerTarget.empty());
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

    public DungeonEditorMainViewPointerTarget target() {
        return target;
    }
}
