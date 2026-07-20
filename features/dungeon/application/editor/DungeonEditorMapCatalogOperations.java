package features.dungeon.application.editor;

public interface DungeonEditorMapCatalogOperations {
    void selectMap(long mapIdValue);

    void reloadMap(long mapIdValue);

    void createMap(String mapName);

    void renameMap(long mapIdValue, String mapName);

    void deleteMap(long mapIdValue);
}
