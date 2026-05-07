package src.view.leftbartabs.sessionplanner;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class SessionPlannerLootMainView extends VBox {

    private final VBox lootBox = new VBox(6);
    private Consumer<SessionPlannerLootMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerLootMainView() {
        getChildren().add(lootSection());
    }

    public void show(MainProjection projection) {
        lootBox.getChildren().clear();
        MainProjection safeProjection = projection == null ? MainProjection.empty() : projection;
        List<MainProjection.LootModel> safe = safeProjection.lootPlaceholders();
        if (safe.isEmpty()) {
            Label empty = new Label("Keine Loot-Platzhalter angelegt.");
            empty.getStyleClass().addAll("text-secondary", "session-planner-empty");
            lootBox.getChildren().add(empty);
            return;
        }
        for (MainProjection.LootModel loot : safe) {
            lootBox.getChildren().add(lootCard(loot));
        }
    }

    public void onViewInputEvent(Consumer<SessionPlannerLootMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private VBox lootSection() {
        Label header = new Label("Loot-Platzhalter");
        header.getStyleClass().addAll("section-header", "text-muted");
        Button addButton = new Button("Loot-Platzhalter");
        addButton.getStyleClass().addAll("compact", "accent");
        addButton.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerLootMainViewInputEvent(0L)));
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
        Button remove = new Button("Entfernen");
        remove.getStyleClass().addAll("compact", "flat");
        remove.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerLootMainViewInputEvent(loot.token())));
        HBox row = new HBox(8, label, spacer, remove);
        row.setAlignment(Pos.CENTER_LEFT);
        row.getStyleClass().add("session-planner-loot-card");
        row.setPadding(new Insets(8, 10, 8, 10));
        return row;
    }
}
