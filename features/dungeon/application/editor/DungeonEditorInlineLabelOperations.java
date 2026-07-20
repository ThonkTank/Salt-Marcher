package features.dungeon.application.editor;

public interface DungeonEditorInlineLabelOperations {
    void beginInlineLabelEdit(DungeonEditorInlineLabelEditSession session);

    void updateInlineLabelEditDraft(String text);

    void cancelInlineLabelEdit();

    void commitInlineLabelEdit(String text);
}
