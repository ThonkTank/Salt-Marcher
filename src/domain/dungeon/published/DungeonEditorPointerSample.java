package src.domain.dungeon.published;

public record DungeonEditorPointerSample(
        double canvasX,
        double canvasY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        DungeonEditorPointerTarget target
) {
    public DungeonEditorPointerSample {
        target = target == null ? DungeonEditorPointerTarget.empty() : target;
    }

    public static DungeonEditorPointerSample empty() {
        return new DungeonEditorPointerSample(0.0, 0.0, false, false, DungeonEditorPointerTarget.empty());
    }
}
