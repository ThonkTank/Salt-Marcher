package src.view.dungeonshared.interactor;

/**
 * View-local overlay presentation modes for dungeon floor placeholders.
 */
public enum DungeonOverlayMode {
    OFF("Aus"),
    NEARBY("Nachbarn"),
    SELECTED("Auswahl");

    private final String label;

    DungeonOverlayMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean usesRange() {
        return this == NEARBY;
    }

    public boolean usesSelectedLevels() {
        return this == SELECTED;
    }
}
