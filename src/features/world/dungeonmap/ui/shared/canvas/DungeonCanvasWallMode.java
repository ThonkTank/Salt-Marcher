package features.world.dungeonmap.ui.shared.canvas;

public enum DungeonCanvasWallMode {
    PAINT_WALL,
    ERASE_WALL;

    public boolean paintsWalls() {
        return this == PAINT_WALL;
    }

    public boolean erasesWalls() {
        return this == ERASE_WALL;
    }
}
