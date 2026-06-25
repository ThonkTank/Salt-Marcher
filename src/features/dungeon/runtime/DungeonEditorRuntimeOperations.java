package src.features.dungeon.runtime;

public interface DungeonEditorRuntimeOperations {
    DungeonEditorMapCatalogOperations catalog();

    DungeonEditorControlOperations controls();

    DungeonEditorPointerInteractionOperations pointer();

    DungeonEditorStatePanelDraftOperations statePanelDrafts();

    DungeonEditorInlineLabelOperations inlineLabels();

    DungeonEditorTransitionStairOperations transitionStairs();
}
