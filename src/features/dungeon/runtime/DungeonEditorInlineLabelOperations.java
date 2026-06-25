package src.features.dungeon.runtime;

public interface DungeonEditorInlineLabelOperations {
    void beginInlineLabelEdit(DungeonEditorInlineLabelEditSession session);

    void updateInlineLabelEditDraft(String text);

    void cancelInlineLabelEdit();

    void commitInlineLabelEdit(String text);
}
