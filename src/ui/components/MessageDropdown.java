package ui.components;

import javafx.scene.Node;

/**
 * Compatibility seam for the legacy shared dropdown entrypoint.
 * New shared dropdown work belongs in {@code ui.components.dropdown}.
 */
@SuppressWarnings("unused")
public final class MessageDropdown {

    private final ui.components.dropdown.MessageDropdown delegate = new ui.components.dropdown.MessageDropdown();

    public void show(Node anchor, String title, String message) {
        delegate.show(anchor, title, message);
    }

    public void hide() {
        delegate.hide();
    }
}
