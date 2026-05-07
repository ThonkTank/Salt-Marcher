package src.view.leftbartabs.sessionplanner;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class SessionPlannerLootMainView extends VBox {

    private final LootBox lootBox = new LootBox();
    private Consumer<SessionPlannerLootMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerLootMainView() {
        getChildren().add(lootSection());
    }

    public void show(MainProjection projection) {
        MainProjection safeProjection = projection == null ? MainProjection.empty() : projection;
        List<MainProjection.LootModel> safe = safeProjection.lootPlaceholders();
        if (safe.isEmpty()) {
            lootBox.showEmpty(new StyledLabel("Keine Loot-Platzhalter angelegt.", "text-secondary", "session-planner-empty"));
            return;
        }
        lootBox.showCards(safe.stream().map(this::lootCard).toList());
    }

    public void onViewInputEvent(Consumer<SessionPlannerLootMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(SessionPlannerContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        contributionModel.mainProjectionProperty().addListener((ignored, before, after) -> show(after));
        show(contributionModel.mainProjectionProperty().get());
    }

    private VBox lootSection() {
        Label header = new StyledLabel("Loot-Platzhalter", "section-header", "text-muted");
        Button addButton = new StyledButton("Loot-Platzhalter", "compact", "accent");
        addButton.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerLootMainViewInputEvent(
                        new SessionPlannerLootMainViewInputEvent.AddLootPlaceholderInput())));
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox row = new HBox(8, header, spacer, addButton);
        row.setAlignment(Pos.CENTER_LEFT);
        return new VBox(8, row, lootBox);
    }

    private HBox lootCard(MainProjection.LootModel loot) {
        Label label = new Label(loot.label());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Button remove = new StyledButton("Entfernen", "compact", "flat");
        remove.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerLootMainViewInputEvent(
                        new SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput(loot.token()))));
        return new LootCardRow(label, spacer, remove);
    }

    private static final class LootBox extends VBox {

        private LootBox() {
            super(6);
        }

        private void showEmpty(Node node) {
            getChildren().setAll(node);
        }

        private void showCards(List<? extends Node> cards) {
            getChildren().setAll(cards);
        }
    }

    private static final class StyledLabel extends Label {

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

    private static final class LootCardRow extends HBox {

        private LootCardRow(Node... nodes) {
            super(8, nodes);
            setAlignment(Pos.CENTER_LEFT);
            setPadding(new Insets(8, 10, 8, 10));
            getStyleClass().add("session-planner-loot-card");
        }
    }
}
