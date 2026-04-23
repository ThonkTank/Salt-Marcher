package src.view.slotcontent.topbar.dropdown;

import javafx.scene.control.Button;
import src.view.slotcontent.controls.popup.AnchoredPopupView;

public final class DropdownPopupView {

    private DropdownPopupView() {
        throw new AssertionError("No instances");
    }

    public static void toggleTrailing(
            AnchoredPopupView popup,
            Button triggerButton,
            double popupWidth,
            Runnable onOpen
    ) {
        popup.toggleTrailing(triggerButton, popupWidth, onOpen);
    }
}
