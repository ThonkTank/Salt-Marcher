package src.view.slotcontent.topbar.dropdown;

import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import src.view.slotcontent.primitives.popup.AnchoredPopupContentModel;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public final class DropdownPopupView extends HBox {

    private final Button triggerButton = new Button();
    private final AnchoredPopupContentModel anchoredPopupContentModel = new AnchoredPopupContentModel();
    private final AnchoredPopupView anchoredPopupView;

    private DropdownPopupContentModel contentModel = new DropdownPopupContentModel();
    private Consumer<DropdownPopupViewInputEvent> viewInputEventHandler = ignored -> { };
    private javafx.beans.value.ChangeListener<DropdownPopupContentModel.PopupState> popupStateListener;

    public DropdownPopupView(Node popupContent) {
        anchoredPopupView = new AnchoredPopupView(popupContent, () -> triggerButton);
        anchoredPopupView.bind(anchoredPopupContentModel);
        anchoredPopupView.onViewInputEvent(event -> {
            if (event.interaction().isHidden()) {
                contentModel.popupHidden();
            }
        });
        triggerButton.setOnAction(event -> togglePopup());
        getChildren().add(triggerButton);
        bind(contentModel);
    }

    public void bind(DropdownPopupContentModel contentModel) {
        if (popupStateListener != null) {
            this.contentModel.popupStateProperty().removeListener(popupStateListener);
        }
        this.contentModel = contentModel == null ? new DropdownPopupContentModel() : contentModel;
        popupStateListener = (ignored, before, after) -> applyPopupState(after);
        this.contentModel.popupStateProperty().addListener(popupStateListener);
        applyPopupState(this.contentModel.currentPopupState());
    }

    public void onViewInputEvent(Consumer<DropdownPopupViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void togglePopup() {
        boolean popupOpening = !contentModel.isOpen();
        contentModel.toggleOpen();
        viewInputEventHandler.accept(new DropdownPopupViewInputEvent(popupOpening));
    }

    private void applyPopupState(DropdownPopupContentModel.PopupState popupState) {
        DropdownPopupContentModel.PopupState safeState = popupState == null
                ? DropdownPopupContentModel.PopupState.initial()
                : popupState;
        triggerButton.setText(safeState.triggerText());
        triggerButton.setMnemonicParsing(safeState.mnemonicParsing());
        triggerButton.setAccessibleText(safeState.open()
                ? safeState.openAccessibleText()
                : safeState.closedAccessibleText());
        if (safeState.tooltipText().isBlank()) {
            triggerButton.setTooltip(null);
        } else {
            triggerButton.setTooltip(new Tooltip(safeState.tooltipText()));
        }
        if (safeState.open()) {
            anchoredPopupContentModel.showTrailing(safeState.popupWidth(), false);
        } else {
            anchoredPopupContentModel.hide();
        }
    }
}
