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

    private static final String PMD_LAW_OF_DEMETER = "PMD.LawOfDemeter";

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

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    private VBox createStateCard() {
        Label title = new Label("Reisestatus");
        title.getStyleClass().add("panel-title");
        body.setWrapText(true);
        VBox card = new VBox(6, title, body, actions);
        card.getStyleClass().addAll("card-surface", "content-card");
        return card;
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    private void showActions(List<DungeonTravelContributionModel.ActionProjection> items) {
        actions.getChildren().clear();
        List<DungeonTravelContributionModel.ActionProjection> safeItems = items == null ? List.of() : items;
        if (safeItems.isEmpty()) {
            actions.getChildren().add(emptyActionsHint());
            return;
        }
        actions.getChildren().add(actionsTitle());
        for (DungeonTravelContributionModel.ActionProjection item : safeItems) {
            for (Node node : actionNodes(item)) {
                actions.getChildren().add(node);
            }
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

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    private static Label emptyActionsHint() {
        Label hint = new Label("Keine Reiseaktionen am aktuellen Standort.");
        hint.getStyleClass().add("text-muted");
        hint.setWrapText(true);
        return hint;
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    private static Label actionsTitle() {
        Label title = new Label("Aktionen");
        title.getStyleClass().addAll("section-header", "text-muted");
        return title;
    }

    private List<Node> actionNodes(DungeonTravelContributionModel.ActionProjection item) {
        if (!item.description().isBlank()) {
            return List.of(actionButton(item), actionDescription(item.description()));
        }
        return List.of(actionButton(item));
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    private Button actionButton(DungeonTravelContributionModel.ActionProjection item) {
        Button button = new Button(item.label());
        button.getStyleClass().addAll("toolbar-action-button", "neutral-action");
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> viewInputEventHandler.accept(new DungeonTravelStateViewInputEvent(item.actionId())));
        return button;
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    private static Label actionDescription(String text) {
        Label description = new Label(text);
        description.getStyleClass().add("text-muted");
        description.setWrapText(true);
        return description;
    }
}
