package platform.ui.dropdown;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;

public final class DropdownPopupContentModel {

    private final ReadOnlyObjectWrapper<PopupState> popupState =
            new ReadOnlyObjectWrapper<>(PopupState.initial());

    public ReadOnlyObjectProperty<PopupState> popupStateProperty() {
        return popupState.getReadOnlyProperty();
    }

    public PopupState currentPopupState() {
        return popupState.get();
    }

    public void showPresentation(PopupPresentation presentation) {
        PopupPresentation safePresentation = presentation == null
                ? PopupPresentation.initial()
                : presentation;
        PopupState current = popupState.get();
        setPopupState(new PopupState(
                safePresentation.triggerText(),
                safePresentation.closedAccessibleText(),
                safePresentation.openAccessibleText(),
                safePresentation.tooltipText(),
                safePresentation.mnemonicParsing(),
                safePresentation.popupWidth(),
                current.open()));
    }

    public boolean isOpen() {
        return popupState.get().open();
    }

    public void open() {
        setPopupState(popupState.get().withOpen(true));
    }

    public void close() {
        setPopupState(popupState.get().withOpen(false));
    }

    private void setPopupState(PopupState state) {
        PopupState safeState = state == null ? PopupState.initial() : state;
        popupState.set(safeState);
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }

    public record PopupPresentation(
            String triggerText,
            String closedAccessibleText,
            String openAccessibleText,
            String tooltipText,
            boolean mnemonicParsing,
            double popupWidth
    ) {

        public PopupPresentation {
            triggerText = safe(triggerText);
            closedAccessibleText = safe(closedAccessibleText);
            openAccessibleText = safe(openAccessibleText);
            tooltipText = safe(tooltipText);
            popupWidth = Math.max(0.0, popupWidth);
        }

        static PopupPresentation initial() {
            return new PopupPresentation("", "", "", "", false, 320.0);
        }
    }

    public record PopupState(
            String triggerText,
            String closedAccessibleText,
            String openAccessibleText,
            String tooltipText,
            boolean mnemonicParsing,
            double popupWidth,
            boolean open
    ) {

        public PopupState {
            triggerText = safe(triggerText);
            closedAccessibleText = safe(closedAccessibleText);
            openAccessibleText = safe(openAccessibleText);
            tooltipText = safe(tooltipText);
            popupWidth = Math.max(0.0, popupWidth);
        }

        static PopupState initial() {
            return new PopupState("", "", "", "", false, 320.0, false);
        }

        private PopupState withOpen(boolean open) {
            return new PopupState(
                    triggerText,
                    closedAccessibleText,
                    openAccessibleText,
                    tooltipText,
                    mnemonicParsing,
                    popupWidth,
                    open);
        }
    }
}
