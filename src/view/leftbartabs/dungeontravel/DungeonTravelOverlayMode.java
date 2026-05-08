package src.view.leftbartabs.dungeontravel;

enum DungeonTravelOverlayMode {
    OFF("OFF", "Overlays aus"),
    NEARBY("NEARBY", "Nahe Ebenen"),
    SELECTED("SELECTED", "Ausgewählte Ebenen");

    private final String key;
    private final String label;

    DungeonTravelOverlayMode(String key, String label) {
        this.key = key;
        this.label = label;
    }

    String key() {
        return key;
    }

    String label() {
        return label;
    }

    static DungeonTravelOverlayMode fromKey(String modeKey) {
        if (NEARBY.key.equalsIgnoreCase(modeKey)) {
            return NEARBY;
        }
        if (SELECTED.key.equalsIgnoreCase(modeKey)) {
            return SELECTED;
        }
        return OFF;
    }
}
