package features.world.dungeon.state;

public enum EditorHoverScope {
    OWNER(true, false),
    PART(false, true);

    private final boolean showsTarget;
    private final boolean showsPart;

    EditorHoverScope(boolean showsTarget, boolean showsPart) {
        this.showsTarget = showsTarget;
        this.showsPart = showsPart;
    }

    public boolean showsTarget() {
        return showsTarget;
    }

    public boolean showsPart() {
        return showsPart;
    }
}
