package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonTravelStateView extends VBox {

    private final Label body = new Label();
    private final VBox actions = new VBox(6);
    private Consumer<DungeonTravelStateViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonTravelStateView() {
        setSpacing(12);
        setPadding(new Insets(12));
        getStyleClass().addAll("surface-root", "control-stack");

        Label title = new Label("Travel state");
        title.getStyleClass().add("panel-title");
        body.setWrapText(true);
        VBox card = new VBox(6, title, body, actions);
        card.getStyleClass().addAll("card-surface", "content-card");
        getChildren().add(card);
    }

    public StringProperty stateTextProperty() {
        return body.textProperty();
    }

    public void onViewInputEvent(Consumer<DungeonTravelStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    public void showActions(List<ActionItem> items) {
        actions.getChildren().clear();
        List<ActionItem> safeItems = items == null ? List.of() : items;
        if (safeItems.isEmpty()) {
            Label hint = new Label("Keine Reiseaktionen am aktuellen Standort.");
            hint.getStyleClass().add("text-muted");
            hint.setWrapText(true);
            actions.getChildren().add(hint);
            return;
        }
        Label title = new Label("Aktionen");
        title.getStyleClass().addAll("section-header", "text-muted");
        actions.getChildren().add(title);
        for (ActionItem item : safeItems) {
            Button button = new Button(item.label());
            button.getStyleClass().addAll("toolbar-action-button", "neutral-action");
            button.setMaxWidth(Double.MAX_VALUE);
            button.setOnAction(event -> viewInputEventHandler.accept(new DungeonTravelStateViewInputEvent(item.actionId())));
            actions.getChildren().add(button);
            if (!item.description().isBlank()) {
                Label description = new Label(item.description());
                description.getStyleClass().add("text-muted");
                description.setWrapText(true);
                actions.getChildren().add(description);
            }
        }
    }

    public record ActionItem(
            String actionId,
            String label,
            String description
    ) {
        public ActionItem {
            actionId = actionId == null ? "" : actionId.trim();
            label = label == null || label.isBlank() ? "Aktion" : label.trim();
            description = description == null ? "" : description.trim();
        }
    }
}
