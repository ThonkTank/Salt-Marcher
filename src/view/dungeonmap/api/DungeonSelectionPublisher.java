package src.view.dungeonmap.api;

public interface DungeonSelectionPublisher {

    void clear();

    void showSelection(DungeonSelectionInspectorEntry entry);
}
