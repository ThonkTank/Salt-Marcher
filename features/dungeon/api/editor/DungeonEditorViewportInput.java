package features.dungeon.api.editor;

/** Presentation-owned visible cell bounds for one Dungeon Editor level. */
public record DungeonEditorViewportInput(
        int level,
        int minimumQ,
        int minimumR,
        int maximumQ,
        int maximumR
) {
    public DungeonEditorViewportInput {
        if (maximumQ < minimumQ || maximumR < minimumR) {
            throw new IllegalArgumentException("viewport bounds must be ordered");
        }
    }

    public DungeonEditorViewportInput atLevel(int nextLevel) {
        return new DungeonEditorViewportInput(
                nextLevel, minimumQ, minimumR, maximumQ, maximumR);
    }
}
