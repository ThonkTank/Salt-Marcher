package ui.components;

import javafx.scene.Node;

/**
 * Compatibility seam for the legacy shared dropdown entrypoint.
 * New shared dropdown work belongs in {@code ui.components.dropdown}.
 */
@SuppressWarnings("unused")
public final class ConfirmationDropdown {

    private final ui.components.dropdown.ConfirmationDropdown delegate =
            new ui.components.dropdown.ConfirmationDropdown();

    public void show(Node anchor, String title, String message, String confirmLabel, Runnable onConfirm) {
        delegate.show(anchor, title, message, confirmLabel, onConfirm);
    }

    public void hide() {
        delegate.hide();
    }
}
