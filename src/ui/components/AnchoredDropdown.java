package ui.components;

import javafx.application.Platform;
import javafx.geometry.Bounds;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.stage.Popup;
import javafx.stage.Window;

public final class AnchoredDropdown {

    public enum HorizontalAlignment {
        LEFT,
        RIGHT
    }

    private final Popup popup = new Popup();
    private final Parent content;
    private Node lastAnchor;
    private Runnable onHidden = () -> { };

    public AnchoredDropdown(Parent content) {
        this.content = content;
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(content);
        popup.setOnHidden(event -> {
            if (lastAnchor != null) {
                lastAnchor.requestFocus();
            }
            onHidden.run();
        });
    }

    public void setOnHidden(Runnable onHidden) {
        this.onHidden = onHidden == null ? () -> { } : onHidden;
    }

    public boolean isShowing() {
        return popup.isShowing();
    }

    public void hide() {
        popup.hide();
    }

    public void show(Node anchor) {
        show(anchor, HorizontalAlignment.LEFT, 2);
    }

    public void show(Node anchor, HorizontalAlignment alignment, double verticalOffset) {
        if (anchor == null || anchor.getScene() == null) {
            return;
        }
        Window window = anchor.getScene().getWindow();
        if (window == null) {
            return;
        }
        lastAnchor = anchor;
        if (popup.isShowing()) {
            popup.hide();
        }
        content.applyCss();
        content.layout();
        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds == null) {
            return;
        }
        double width = content.prefWidth(-1);
        if (width <= 0) {
            width = content.getLayoutBounds().getWidth();
        }
        double x = alignment == HorizontalAlignment.RIGHT
                ? bounds.getMaxX() - width
                : bounds.getMinX();
        double y = bounds.getMaxY() + verticalOffset;
        popup.show(window, x, y);
    }

    public void requestFocus(Node node) {
        if (node == null) {
            return;
        }
        Platform.runLater(node::requestFocus);
    }
}
