package features.world.dungeonmap.ui.editor.toolbar;

public enum DungeonColorRenderMode {
    ROOMS("Raumfarben"),
    AREAS("Bereichsfarben");

    private final String label;

    DungeonColorRenderMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
