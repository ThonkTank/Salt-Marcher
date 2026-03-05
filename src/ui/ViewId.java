package ui;

/**
 * Navigation identifiers for views registered with {@link AppShell}.
 * To add a new view: add an entry here, implement {@link AppView},
 * then call {@link AppShell#registerView(ViewId, AppView)} in SaltMarcherApp.
 */
public enum ViewId {
    ENCOUNTER,
    OVERWORLD
}
