package features.hex.api;

public interface HexEditorApi {

    void createMap(CreateHexMapCommand command);

    void loadEditor(LoadHexEditorCommand command);

    void selectMap(SelectHexMapCommand command);

    void reloadAndSelectMap(LoadHexEditorCommand loadCommand, SelectHexMapCommand selectCommand);

    void updateMap(UpdateHexMapCommand command);

    void renameMap(RenameHexMapCommand command);

    void selectTile(SelectHexTileCommand command);

    void paintTerrain(PaintHexTerrainCommand command);

    void saveMarker(SaveHexMarkerCommand command);

    void setActiveTool(SetHexEditorToolCommand command);
}
