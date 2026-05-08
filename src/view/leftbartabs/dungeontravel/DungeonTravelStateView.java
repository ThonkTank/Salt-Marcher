package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.function.Consumer;
import javafx.collections.ObservableList;
import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.Node;
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
        getChildren().add(createStateCard());
    }

    public StringProperty stateTextProperty() {
        return body.textProperty();
    }

    public void onViewInputEvent(Consumer<DungeonTravelStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    private VBox createStateCard() {
        Label title = new Label("Reisestatus");
        addStyleClass(title, "panel-title");
        body.setWrapText(true);
        VBox card = new VBox(6, title, body, actions);
        addStyleClasses(card, "card-surface", "content-card");
        return card;
    }

    private void showActions(List<DungeonTravelContributionModel.ActionProjection> items) {
        ObservableList<Node> children = actions.getChildren();
        children.clear();
        List<DungeonTravelContributionModel.ActionProjection> safeItems = items == null ? List.of() : items;
        if (safeItems.isEmpty()) {
            children.add(emptyActionsHint());
            return;
        }
        children.add(actionsTitle());
        for (DungeonTravelContributionModel.ActionProjection projection : safeItems) {
            appendActionNodes(children, ActionItem.from(projection));
        }
    }

    public void bind(DungeonTravelContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        stateTextProperty().bind(contributionModel.stateProperty());
        contributionModel.actionsProperty().addListener((ignored, before, after) -> showActions(after));
        showActions(contributionModel.actionsProperty().get());
    }

    private static Label emptyActionsHint() {
        Label hint = new Label("Keine Reiseaktionen am aktuellen Standort.");
        addStyleClass(hint, "text-muted");
        hint.setWrapText(true);
        return hint;
    }

    private static Label actionsTitle() {
        Label title = new Label("Aktionen");
        addStyleClasses(title, "section-header", "text-muted");
        return title;
    }

    private void appendActionNodes(ObservableList<Node> children, ActionItem item) {
        children.add(actionButton(item));
        if (item.hasDescription()) {
            children.add(actionDescription(item.descriptionText()));
        }
    }

    private Button actionButton(ActionItem item) {
        Button button = new Button(item.buttonLabel());
        addStyleClasses(button, "toolbar-action-button", "neutral-action");
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> viewInputEventHandler.accept(new DungeonTravelStateViewInputEvent(item.actionId())));
        return button;
    }

    private static Label actionDescription(String text) {
        Label description = new Label(text);
        addStyleClass(description, "text-muted");
        description.setWrapText(true);
        return description;
    }

    private static void addStyleClass(Node node, String styleClass) {
        ObservableList<String> styleClasses = node.getStyleClass();
        styleClasses.add(styleClass);
    }

    private static void addStyleClasses(Node node, String... styleClasses) {
        ObservableList<String> classes = node.getStyleClass();
        classes.addAll(styleClasses);
    }

    private static final class ActionItem {

        private final String actionId;
        private final String buttonLabel;
        private final String descriptionText;

        private ActionItem(String actionId, String buttonLabel, String descriptionText) {
            this.actionId = actionId;
            this.buttonLabel = buttonLabel;
            this.descriptionText = descriptionText;
        }

        static ActionItem from(DungeonTravelContributionModel.ActionProjection projection) {
            return new ActionItem(
                    projection.actionId(),
                    projection.buttonLabel(),
                    projection.descriptionText());
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
