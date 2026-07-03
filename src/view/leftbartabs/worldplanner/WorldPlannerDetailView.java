package src.view.leftbartabs.worldplanner;

import java.util.Objects;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class WorldPlannerDetailView extends VBox {

    WorldPlannerDetailView() {
        getStyleClass().add("world-planner-detail");
    }

    public void bind(WorldPlannerDetailContentModel model) {
        WorldPlannerDetailContentModel safeModel = Objects.requireNonNull(model, "model");
        safeModel.projectionProperty().addListener((observable, oldValue, newValue) -> render(newValue));
        render(safeModel.projectionProperty().get());
    }

    private void render(WorldPlannerDetailContentModel.Projection projection) {
        getChildren().clear();
        Label title = new Label(projection.title());
        title.getStyleClass().add("world-planner-section-title");
        getChildren().add(title);
        for (WorldPlannerDetailContentModel.Line line : projection.lines()) {
            getChildren().add(line(line));
        }
    }

    private static VBox line(WorldPlannerDetailContentModel.Line line) {
        Label label = new Label(line.label());
        label.getStyleClass().add("text-muted");
        Label value = new Label(line.value());
        value.setWrapText(true);
        VBox box = new VBox(2, label, value);
        box.getStyleClass().add("world-planner-detail-line");
        return box;
    }
}
