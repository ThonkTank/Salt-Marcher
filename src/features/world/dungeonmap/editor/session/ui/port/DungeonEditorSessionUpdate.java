package features.world.dungeonmap.editor.session.ui.port;

import features.world.dungeonmap.layout.model.DungeonLayout;

public final class DungeonEditorSessionUpdate {

    public enum Kind {
        LAYOUT_CHANGED,
        SELECTION_CHANGED,
        STATE_PANE_CHANGED,
        RELOAD_LAYOUT
    }

    private final Kind kind;
    private final DungeonLayout layout;
    private final Long preferredMapId;

    private DungeonEditorSessionUpdate(Kind kind, DungeonLayout layout, Long preferredMapId) {
        this.kind = kind;
        this.layout = layout;
        this.preferredMapId = preferredMapId;
    }

    public static DungeonEditorSessionUpdate layoutChanged(DungeonLayout layout) {
        return new DungeonEditorSessionUpdate(Kind.LAYOUT_CHANGED, layout, null);
    }

    public static DungeonEditorSessionUpdate selectionChanged() {
        return new DungeonEditorSessionUpdate(Kind.SELECTION_CHANGED, null, null);
    }

    public static DungeonEditorSessionUpdate statePaneChanged() {
        return new DungeonEditorSessionUpdate(Kind.STATE_PANE_CHANGED, null, null);
    }

    public static DungeonEditorSessionUpdate reloadLayout(Long preferredMapId) {
        return new DungeonEditorSessionUpdate(Kind.RELOAD_LAYOUT, null, preferredMapId);
    }

    public Kind kind() {
        return kind;
    }

    public DungeonLayout layout() {
        return layout;
    }

    public Long preferredMapId() {
        return preferredMapId;
    }
}
