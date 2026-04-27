package src.view.primitives.popup;

import javafx.application.Platform;
import javafx.event.EventHandler;
import javafx.geometry.Bounds;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.stage.Popup;
import javafx.stage.WindowEvent;
import org.jspecify.annotations.Nullable;

public final class AnchoredPopupView {

    private final Popup popup = new Popup();
    private @Nullable Node focusReturn;

    public AnchoredPopupView() {
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                hide();
                event.consume();
            }
        });
        popup.addEventHandler(WindowEvent.WINDOW_HIDDEN, event -> {
            if (focusReturn != null) {
                focusReturn.requestFocus();
            }
        });
    }

    public void setContent(Node content) {
        popup.getContent().setAll(content);
    }

    public void hide() {
        popup.hide();
    }

    public boolean isShowing() {
        return popup.isShowing();
    }

    public void toggleBelow(Node anchor, @Nullable Runnable beforeShow) {
        if (isShowing()) {
            hide();
            return;
        }
        if (beforeShow != null) {
            beforeShow.run();
        }
        showBelow(anchor);
    }

    public void toggleTrailing(Node anchor, double popupWidth, @Nullable Runnable beforeShow) {
        if (isShowing()) {
            hide();
            return;
        }
        if (beforeShow != null) {
            beforeShow.run();
        }
        showTrailing(anchor, popupWidth);
    }

    public void showBelow(Node anchor) {
        show(anchor, 0, 2);
    }

    public void showBelow(Node anchor, double yOffset) {
        show(anchor, 0, yOffset);
    }

    public void showTrailing(Node anchor, double popupWidth) {
        if (!canShow(anchor)) {
            return;
        }
        focusReturn = anchor;
        anchor.applyCss();
        if (anchor instanceof Parent parent) {
            parent.layout();
        }
        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) {
            popup.show(anchor, bounds.getMaxX() - popupWidth, bounds.getMaxY() + 2);
        }
    }

    public void addOnShowing(EventHandler<WindowEvent> handler) {
        if (handler != null) {
            popup.addEventHandler(WindowEvent.WINDOW_SHOWING, handler);
        }
    }

    public void addOnHiding(EventHandler<WindowEvent> handler) {
        if (handler != null) {
            popup.addEventHandler(WindowEvent.WINDOW_HIDING, handler);
        }
    }

    public void addOnHidden(EventHandler<WindowEvent> handler) {
        if (handler != null) {
            popup.addEventHandler(WindowEvent.WINDOW_HIDDEN, handler);
        }
    }

    public void focusAfterShown(Node node) {
        if (node != null) {
            Platform.runLater(node::requestFocus);
        }
    }

    private void show(Node anchor, double xOffset, double yOffset) {
        if (!canShow(anchor)) {
            return;
        }
        focusReturn = anchor;
        anchor.applyCss();
        if (anchor instanceof Parent parent) {
            parent.layout();
        }
        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) {
            popup.show(anchor, bounds.getMinX() + xOffset, bounds.getMaxY() + yOffset);
        }
    }

    private static boolean canShow(Node anchor) {
        return anchor != null && anchor.getScene() != null;
    }
}
