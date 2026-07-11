package src.view.leftbartabs.worldplanner;

import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class WorldPlannerFactionMainView extends VBox {

    private final ListView<String> factions = new ListView<>();
    private final Label emptyText = new Label();
    private Consumer<FactionMainInput> eventSink = event -> { };

    WorldPlannerFactionMainView() {
        getStyleClass().addAll("world-planner-main", "world-planner-module-main");
        Label title = new Label("Fraktionen");
        title.getStyleClass().add("world-planner-section-title");
        emptyText.getStyleClass().add("text-muted");
        getChildren().addAll(title, factions, emptyText);
        setVgrow(factions, Priority.ALWAYS);
        factions.setOnMouseClicked(event -> emit());
        factions.setOnKeyReleased(event -> emit());
    }

    public void bind(WorldPlannerViewModel viewModel) {
        WorldPlannerViewModel safeModel = Objects.requireNonNull(viewModel, "viewModel");
        safeModel.factionProjectionProperty().addListener((observable, oldValue, newValue) -> render(newValue));
        render(safeModel.factionProjectionProperty().get());
    }

    public void onViewInputEvent(Consumer<FactionMainInput> sink) {
        eventSink = sink == null ? event -> { } : sink;
    }

    private void render(FactionProjection projection) {
        setVisible(projection.active());
        setManaged(projection.active());
        factions.getItems().setAll(projection.factionLabels());
        if (projection.selectedFactionIndex() >= 0 && projection.selectedFactionIndex() < factions.getItems().size()) {
            factions.getSelectionModel().select(projection.selectedFactionIndex());
        } else {
            factions.getSelectionModel().clearSelection();
        }
        emptyText.setText(projection.emptyText());
        emptyText.setVisible(!projection.emptyText().isBlank());
        emptyText.setManaged(!projection.emptyText().isBlank());
    }

    private void emit() {
        eventSink.accept(new FactionMainInput(
                factions.getSelectionModel().getSelectedIndex()));
    }
}
