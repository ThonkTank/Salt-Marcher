package ui.components;

import javafx.scene.Node;

import java.util.function.Consumer;

/**
 * Compatibility seam for the legacy shared dropdown entrypoint.
 * New shared dropdown work belongs in {@code ui.components.dropdown}.
 */
@SuppressWarnings("unused")
public final class TextInputDropdown {

    private final ui.components.dropdown.TextInputDropdown delegate = new ui.components.dropdown.TextInputDropdown();

    public void show(
            Node anchor,
            String title,
            String label,
            String initialValue,
            String submitLabel,
            Consumer<String> onSubmit
    ) {
        delegate.show(anchor, title, label, initialValue, submitLabel, onSubmit);
    }

    public void showError(String message) {
        delegate.showError(message);
    }

    public void hide() {
        delegate.hide();
    }
}
