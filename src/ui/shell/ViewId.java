package ui.shell;

/**
 * Navigation identifiers for views registered with {@link AppShell}.
 * To add a new view: add an entry here, implement {@link AppView},
 * then call {@link AppShell#registerView(ViewId, AppView)} in SaltMarcherApp.
 */
public enum ViewId {
    ENCOUNTER(ViewCategory.SESSION),
    OVERWORLD(ViewCategory.SESSION),
    DUNGEON(ViewCategory.SESSION),
    MAP_EDITOR(ViewCategory.EDITOR),
    DUNGEON_EDITOR(ViewCategory.EDITOR),
    TABLE_EDITOR(ViewCategory.EDITOR),
    SPELLS(ViewCategory.EDITOR);

    private final ViewCategory category;
    ViewId(ViewCategory category) { this.category = category; }
    public ViewCategory getCategory() { return category; }
}
