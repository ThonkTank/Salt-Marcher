package src.view.slotcontent.controls.dungeoncontrol;

public enum DungeonLevelOverlayMode {
    OFF("Aus", false, false),
    NEARBY("Nachbarn", true, false),
    SELECTED("Auswahl", false, true);

    private final String label;
    private final boolean usesRange;
    private final boolean usesSelectedLevels;

    DungeonLevelOverlayMode(String label, boolean usesRange, boolean usesSelectedLevels) {
        this.label = label;
        this.usesRange = usesRange;
        this.usesSelectedLevels = usesSelectedLevels;
    }

    public String label() {
        return label;
    }

    public boolean usesRange() {
        return usesRange;
    }

    public boolean usesSelectedLevels() {
        return usesSelectedLevels;
    }
}
