package platform.ui.dropdown;

import java.util.function.Consumer;
import javafx.geometry.Bounds;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.StackPane;
import javafx.stage.Popup;

public final class DropdownPopupView extends HBox {

    private final Button triggerButton = new Button();
    private final Popup popup = new Popup();
    private final StackPane popupHost = new StackPane();

    private Consumer<DropdownPopupViewInputEvent> viewInputEventHandler = ignored -> { };

    public DropdownPopupView(Node popupContent) {
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popupHost.getChildren().setAll(popupContent == null ? java.util.List.of() : java.util.List.of(popupContent));
        popup.getContent().setAll(popupHost);
        popup.setOnAutoHide(event -> viewInputEventHandler.accept(new DropdownPopupViewInputEvent(false, true)));
        triggerButton.setOnAction(event -> togglePopup());
        getChildren().add(triggerButton);
    }

    public void bind(DropdownPopupContentModel contentModel) {
        contentModel.popupStateProperty().addListener((ignored, before, after) -> applyPopupState(after));
        applyPopupState(contentModel.currentPopupState());
    }

    public void onViewInputEvent(Consumer<DropdownPopupViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void togglePopup() {
        viewInputEventHandler.accept(new DropdownPopupViewInputEvent(true, false));
    }

    private void applyPopupState(DropdownPopupContentModel.PopupState popupState) {
        if (popupState == null) {
            hidePopupIfShowing();
            return;
        }
        triggerButton.setText(popupState.triggerText());
        triggerButton.setMnemonicParsing(popupState.mnemonicParsing());
        triggerButton.setAccessibleText(popupState.open()
                ? popupState.openAccessibleText()
                : popupState.closedAccessibleText());
        if (popupState.tooltipText().isBlank()) {
            triggerButton.setTooltip(null);
        } else {
            triggerButton.setTooltip(new Tooltip(popupState.tooltipText()));
        }
        if (popupState.open()) {
            showPopup(popupState.popupWidth());
        } else {
            hidePopupIfShowing();
        }
    }

    private void showPopup(double popupWidth) {
        if (popup.isShowing()) {
            return;
        }
        triggerButton.applyCss();
        Parent parent = triggerButton.getParent();
        if (parent != null) {
            parent.layout();
        }
        Bounds bounds = triggerButton.localToScreen(triggerButton.getBoundsInLocal());
        if (bounds == null) {
            viewInputEventHandler.accept(new DropdownPopupViewInputEvent(false, true));
            return;
        }
        popup.show(triggerButton, bounds.getMaxX() - popupWidth, bounds.getMaxY() + 2.0);
    }

    private void hidePopupIfShowing() {
        if (popup.isShowing()) {
            popup.hide();
        }
    }
}
