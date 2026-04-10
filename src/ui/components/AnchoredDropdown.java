package ui.components;

import javafx.scene.Node;
import javafx.scene.Parent;

/**
 * Compatibility seam for the legacy shared dropdown entrypoint.
 * New shared dropdown work belongs in {@code ui.components.dropdown}.
 */
@SuppressWarnings("unused")
public final class AnchoredDropdown {

    public enum HorizontalAlignment {
        LEFT,
        RIGHT
    }

    private final ui.components.dropdown.AnchoredDropdown delegate;

    public AnchoredDropdown(Parent content) {
        delegate = new ui.components.dropdown.AnchoredDropdown(content);
    }

    public void setOnHidden(Runnable onHidden) {
        delegate.setOnHidden(onHidden);
    }

    public boolean isShowing() {
        return delegate.isShowing();
    }

    public void hide() {
        delegate.hide();
    }

    public void hideWithoutFocusRestore() {
        delegate.hideWithoutFocusRestore();
    }

    public void show(Node anchor) {
        delegate.show(anchor);
    }

    public void show(Node anchor, HorizontalAlignment alignment, double verticalOffset) {
        delegate.show(anchor, mapAlignment(alignment), verticalOffset);
    }

    public void requestFocus(Node node) {
        delegate.requestFocus(node);
    }

    private static ui.components.dropdown.AnchoredDropdown.HorizontalAlignment mapAlignment(
            HorizontalAlignment alignment
    ) {
        return alignment == HorizontalAlignment.RIGHT
                ? ui.components.dropdown.AnchoredDropdown.HorizontalAlignment.RIGHT
                : ui.components.dropdown.AnchoredDropdown.HorizontalAlignment.LEFT;
    }
}
