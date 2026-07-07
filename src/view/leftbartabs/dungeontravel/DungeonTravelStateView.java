package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonTravelStateView extends VBox {

    private final Label body = new Label();
    private final VBox rows = new ActionRows();
    private Consumer<DungeonTravelStateViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonTravelStateView() {
        getStyleClass().addAll("surface-root", "control-stack", "dungeon-state-panel");
        body.setWrapText(true);
        getChildren().add(new StateCard(body, rows));
    }

    public void onViewInputEvent(Consumer<DungeonTravelStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    private void showActions(List<DungeonTravelStateContentModel.ActionItem> items) {
        actionRows().showItems(items, this::publishViewInputEvent);
    }

    private void publishViewInputEvent(DungeonTravelStateViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private ActionRows actionRows() {
        return (ActionRows) rows;
    }

    public void bind(DungeonTravelStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        body.textProperty().bind(contentModel.stateProperty());
        contentModel.actionsProperty().addListener((ignored, before, after) -> showActions(after));
        showActions(contentModel.actionsProperty().get());
    }

    private static final class StateCard extends VBox {

        private StateCard(Label body, VBox rows) {
            super(6, new StyledLabel("Reisestatus", "panel-title"), body, rows);
            getStyleClass().addAll("card-surface", "content-card");
        }
    }

    private static final class ActionRows extends VBox {

        private ActionRows() {
            super(6);
        }

        private void showItems(
                List<DungeonTravelStateContentModel.ActionItem> items,
                Consumer<DungeonTravelStateViewInputEvent> publisher
        ) {
            List<DungeonTravelStateContentModel.ActionItem> safeItems = items == null ? List.of() : items;
            if (safeItems.isEmpty()) {
                getChildren().setAll(new HintLabel("Keine Reiseaktionen am aktuellen Standort."));
                return;
            }
            List<Node> nodes = new java.util.ArrayList<>();
            nodes.add(new StyledLabel("Aktionen", "section-header", "text-muted"));
            for (DungeonTravelStateContentModel.ActionItem item : safeItems) {
                nodes.add(new ActionRow(
                        item.rowIndex(),
                        item.buttonLabel(),
                        item.hasDescription(),
                        item.descriptionText(),
                        publisher));
            }
            getChildren().setAll(nodes);
        }
    }

    private static final class ActionRow extends VBox {

        private ActionRow(
                int rowIndex,
                String buttonLabel,
                boolean hasDescription,
                String descriptionText,
                Consumer<DungeonTravelStateViewInputEvent> publisher
        ) {
            super(4);
            getChildren().add(actionButton(rowIndex, buttonLabel, publisher));
            if (hasDescription) {
                getChildren().add(new HintLabel(descriptionText));
            }
        }

        private static Button actionButton(
                int rowIndex,
                String buttonLabel,
                Consumer<DungeonTravelStateViewInputEvent> publisher
        ) {
            Button button = new StyledButton(buttonLabel, "toolbar-action-button", "neutral-action");
            button.setMaxWidth(Double.MAX_VALUE);
            button.setOnAction(event -> publisher.accept(new DungeonTravelStateViewInputEvent(rowIndex)));
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
