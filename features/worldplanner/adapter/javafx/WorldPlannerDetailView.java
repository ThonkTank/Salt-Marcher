package features.worldplanner.adapter.javafx;

import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class WorldPlannerDetailView extends VBox {

    WorldPlannerDetailView() {
        getStyleClass().add("world-planner-detail");
    }

    public void render(DetailProjection projection) {
        renderProjection(projection == null ? DetailProjection.empty() : projection);
    }

    private void renderProjection(DetailProjection projection) {
        getChildren().clear();
        Label title = new Label(projection.title());
        title.getStyleClass().add("world-planner-section-title");
        getChildren().add(title);
        for (DetailLine line : projection.lines()) {
            getChildren().add(line(line));
        }
    }

    private static VBox line(DetailLine line) {
        Label label = new Label(line.label());
        label.getStyleClass().add("text-muted");
        Label value = new Label(line.value());
        value.setWrapText(true);
        VBox box = new VBox(2, label, value);
        box.getStyleClass().add("world-planner-detail-line");
        return box;
    }
}
