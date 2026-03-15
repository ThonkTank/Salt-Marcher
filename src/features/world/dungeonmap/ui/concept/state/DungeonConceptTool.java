package features.world.dungeonmap.ui.concept.state;

public enum DungeonConceptTool {
    SELECT("Auswahl"),
    ROOM("Raum"),
    CONNECT("Verbinden"),
    MOVE("Verschieben");

    private final String label;

    DungeonConceptTool(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
