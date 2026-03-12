package features.world.dungeonmap.ui.editor.controls;

public enum PassageEditorMode {
    PLACE_PASSAGE("Durchgang setzen"),
    DELETE_PASSAGE("Durchgang loeschen");

    private final String label;

    PassageEditorMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean placesPassages() {
        return this == PLACE_PASSAGE;
    }

    public boolean deletesPassages() {
        return this == DELETE_PASSAGE;
    }
}
