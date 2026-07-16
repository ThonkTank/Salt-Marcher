package features.worldplanner.adapter.javafx;

import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class WorldPlannerLocationMainView extends VBox {

    private final ListView<String> locations = new ListView<>();
    private final Label emptyText = new Label();
    private Consumer<LocationMainInput> eventSink = event -> { };

    WorldPlannerLocationMainView() {
        getStyleClass().addAll("world-planner-main", "world-planner-module-main");
        Label title = new Label("Locations");
        title.getStyleClass().add("world-planner-section-title");
        emptyText.getStyleClass().add("text-muted");
        getChildren().addAll(title, locations, emptyText);
        setVgrow(locations, Priority.ALWAYS);
        locations.setOnMouseClicked(event -> emit());
        locations.setOnKeyReleased(event -> emit());
    }

    public void bind(WorldPlannerViewModel viewModel) {
        WorldPlannerViewModel safeModel = Objects.requireNonNull(viewModel, "viewModel");
        safeModel.locationProjectionProperty().addListener((observable, oldValue, newValue) -> render(newValue));
        render(safeModel.locationProjectionProperty().get());
    }

    public void onViewInputEvent(Consumer<LocationMainInput> sink) {
        eventSink = sink == null ? event -> { } : sink;
    }

    private void render(LocationProjection projection) {
        setVisible(projection.active());
        setManaged(projection.active());
        locations.getItems().setAll(projection.locationLabels());
        if (projection.selectedLocationIndex() >= 0 && projection.selectedLocationIndex() < locations.getItems().size()) {
            locations.getSelectionModel().select(projection.selectedLocationIndex());
        } else {
            locations.getSelectionModel().clearSelection();
        }
        emptyText.setText(projection.emptyText());
        emptyText.setVisible(!projection.emptyText().isBlank());
        emptyText.setManaged(!projection.emptyText().isBlank());
    }

    private void emit() {
        eventSink.accept(new LocationMainInput(
                locations.getSelectionModel().getSelectedIndex()));
    }
}
