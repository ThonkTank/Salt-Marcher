package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonTravelStateView extends VBox {

    private final Label body = new Label();
    private final ActionListView actions = new ActionListView();
    private Consumer<DungeonTravelStateViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonTravelStateView() {
        setSpacing(12);
        setPadding(new Insets(12));
        getStyleClass().addAll("surface-root", "control-stack");
        body.setWrapText(true);
        getChildren().add(new StateCard(body, actions));
    }

    public StringProperty stateTextProperty() {
        return body.textProperty();
    }

    public void onViewInputEvent(Consumer<DungeonTravelStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    private void showActions(List<DungeonTravelContributionModel.ActionProjection> items) {
        actions.showItems(items, viewInputEventHandler);
    }

    public void bind(DungeonTravelContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        stateTextProperty().bind(contributionModel.stateProperty());
        contributionModel.actionsProperty().addListener((ignored, before, after) -> showActions(after));
        showActions(contributionModel.actionsProperty().get());
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

    private static final class StateCard extends VBox {

        private StateCard(Label body, ActionListView actions) {
            super(6, new StyledLabel("Reisestatus", "panel-title"), body, actions);
            getStyleClass().addAll("card-surface", "content-card");
        }
    }

    private static final class ActionListView extends VBox {

        private ActionListView() {
            super(6);
        }

        private void showItems(
                List<DungeonTravelContributionModel.ActionProjection> items,
                Consumer<DungeonTravelStateViewInputEvent> publisher
        ) {
            List<DungeonTravelContributionModel.ActionProjection> safeItems = items == null ? List.of() : items;
            if (safeItems.isEmpty()) {
                getChildren().setAll(new HintLabel("Keine Reiseaktionen am aktuellen Standort."));
                return;
            }
            List<Node> nodes = new java.util.ArrayList<>();
            nodes.add(new StyledLabel("Aktionen", "section-header", "text-muted"));
            for (DungeonTravelContributionModel.ActionProjection projection : safeItems) {
                nodes.add(new ActionRow(ActionItem.from(projection), publisher));
            }
            getChildren().setAll(nodes);
        }
    }

    private static final class ActionRow extends VBox {

        private ActionRow(
                ActionItem item,
                Consumer<DungeonTravelStateViewInputEvent> publisher
        ) {
            super(4);
            getChildren().add(actionButton(item, publisher));
            if (item.hasDescription()) {
                getChildren().add(new HintLabel(item.descriptionText()));
            }
        }

        private static Button actionButton(
                ActionItem item,
                Consumer<DungeonTravelStateViewInputEvent> publisher
        ) {
            Button button = new StyledButton(item.buttonLabel(), "toolbar-action-button", "neutral-action");
            button.setMaxWidth(Double.MAX_VALUE);
            button.setOnAction(event -> publisher.accept(new DungeonTravelStateViewInputEvent(item.actionId())));
            return button;
        }
    }

    private static final class HintLabel extends StyledLabel {

        private HintLabel(String text) {
            super(text, "text-muted");
            setWrapText(true);
        }
    }

    private static class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class StyledButton extends Button {

        private StyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }
}
