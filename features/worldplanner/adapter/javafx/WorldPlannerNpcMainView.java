package features.worldplanner.adapter.javafx;

import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class WorldPlannerNpcMainView extends VBox {

    private final ListView<String> npcs = new ListView<>();
    private final Label emptyText = new Label();
    private Consumer<NpcMainInput> eventSink = event -> { };

    WorldPlannerNpcMainView() {
        getStyleClass().addAll("world-planner-main", "world-planner-module-main");
        Label title = new Label("NPCs");
        title.getStyleClass().add("world-planner-section-title");
        emptyText.getStyleClass().add("text-muted");
        getChildren().addAll(title, npcs, emptyText);
        setVgrow(npcs, Priority.ALWAYS);
        npcs.setOnMouseClicked(event -> emit());
        npcs.setOnKeyReleased(event -> emit());
    }

    public void bind(WorldPlannerViewModel viewModel) {
        WorldPlannerViewModel safeModel = Objects.requireNonNull(viewModel, "viewModel");
        safeModel.npcProjectionProperty().addListener((observable, oldValue, newValue) -> render(newValue));
        render(safeModel.npcProjectionProperty().get());
    }

    public void onViewInputEvent(Consumer<NpcMainInput> sink) {
        eventSink = sink == null ? event -> { } : sink;
    }

    private void render(NpcProjection projection) {
        setVisible(projection.active());
        setManaged(projection.active());
        npcs.getItems().setAll(projection.npcLabels());
        if (projection.selectedNpcIndex() >= 0 && projection.selectedNpcIndex() < npcs.getItems().size()) {
            npcs.getSelectionModel().select(projection.selectedNpcIndex());
        } else {
            npcs.getSelectionModel().clearSelection();
        }
        emptyText.setText(projection.emptyText());
        emptyText.setVisible(!projection.emptyText().isBlank());
        emptyText.setManaged(!projection.emptyText().isBlank());
    }

    private void emit() {
        eventSink.accept(new NpcMainInput(
                npcs.getSelectionModel().getSelectedIndex()));
    }
}
