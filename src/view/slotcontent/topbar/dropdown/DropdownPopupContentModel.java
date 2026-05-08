package src.view.slotcontent.topbar.dropdown;

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

    public void showPresentation(
            @Nullable String triggerText,
            @Nullable String closedAccessibleText,
            @Nullable String openAccessibleText,
            @Nullable String tooltipText,
            boolean mnemonicParsing,
            double popupWidth
    ) {
        PopupState current = popupState.get();
        popupState.set(new PopupState(
                safe(triggerText),
                safe(closedAccessibleText),
                safe(openAccessibleText),
                safe(tooltipText),
                mnemonicParsing,
                Math.max(0.0, popupWidth),
                current.open()));
    }

    public boolean isOpen() {
        return popupState.get().open();
    }

    public void toggleOpen() {
        PopupState current = popupState.get();
        popupState.set(current.withOpen(!current.open()));
    }

    public void close() {
        popupState.set(popupState.get().withOpen(false));
    }

    void popupHidden() {
        close();
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
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
