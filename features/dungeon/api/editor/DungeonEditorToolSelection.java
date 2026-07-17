package features.dungeon.api.editor;

/** Active tool family and its currently selected option. */
public record DungeonEditorToolSelection(
        DungeonEditorToolFamily family,
        String optionKey
) {
    public DungeonEditorToolSelection {
        family = family == null ? DungeonEditorToolFamily.SELECT : family;
        optionKey = optionKey == null || optionKey.isBlank() ? "SELECT" : optionKey.strip();
    }

    public static DungeonEditorToolSelection select() {
        return new DungeonEditorToolSelection(DungeonEditorToolFamily.SELECT, "SELECT");
    }
}
