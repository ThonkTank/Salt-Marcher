package src.view.slotcontent.topbar.dropdown;

import javafx.geometry.Bounds;
import javafx.scene.control.Button;
import javafx.stage.Popup;

public final class DropdownPopupView {

    private DropdownPopupView() {
        throw new AssertionError("No instances");
    }

    public static void toggleTrailing(Popup popup, Button triggerButton, double popupWidth, Runnable onOpen) {
        if (popup.isShowing()) {
            popup.hide();
            return;
        }
        onOpen.run();
        triggerButton.applyCss();
        triggerButton.layout();
        Bounds bounds = triggerButton.localToScreen(triggerButton.getBoundsInLocal());
        if (bounds != null) {
            popup.show(triggerButton, bounds.getMaxX() - popupWidth, bounds.getMaxY() + 2.0);
        }
    }
}
