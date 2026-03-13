package features.world.dungeonmap.ui.shared.canvas;

public enum DungeonCanvasPassageMode {
    PLACE_PASSAGE,
    DELETE_PASSAGE;

    public boolean deletesPassages() {
        return this == DELETE_PASSAGE;
    }
}
