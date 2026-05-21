package src.view.leftbartabs.dungeontravel;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;

final class DungeonTravelStateContentModel {

    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<List<ActionItem>> actions =
            new ReadOnlyObjectWrapper<>(List.of());

    ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<List<ActionItem>> actionsProperty() {
        return actions.getReadOnlyProperty();
    }

    void showState(String text) {
        state.set(text == null ? "" : text);
    }

    void showActions(List<ActionItem> items) {
        actions.set(items == null ? List.of() : List.copyOf(items));
    }

    void apply(String stateText, List<ActionItem> items) {
        showState(stateText);
        showActions(items);
    }

    static final class ActionItem {

        private final String actionId;
        private final String buttonLabel;
        private final String descriptionText;

        private ActionItem(String actionId, String buttonLabel, String descriptionText) {
            this.actionId = actionId == null ? "" : actionId.trim();
            this.buttonLabel = buttonLabel == null ? "" : buttonLabel;
            this.descriptionText = descriptionText == null ? "" : descriptionText;
        }

        static ActionItem of(String actionId, String buttonLabel, String descriptionText) {
            return new ActionItem(actionId, buttonLabel, descriptionText);
        }

        String actionId() {
            return actionId;
        }

        String buttonLabel() {
            return buttonLabel;
        }

        boolean hasDescription() {
            return !descriptionText.isBlank();
        }

        String descriptionText() {
            return descriptionText;
        }
    }
}
