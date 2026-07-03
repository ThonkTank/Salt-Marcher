package src.view.leftbartabs.worldplanner;

import java.util.Objects;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class WorldPlannerSourceMainView extends VBox {

    private final Label summary = new Label();
    private final ListView<String> rows = new ListView<>();

    WorldPlannerSourceMainView() {
        getStyleClass().addAll("world-planner-main", "world-planner-module-main");
        Label title = new Label("Encounter Sources");
        title.getStyleClass().add("world-planner-section-title");
        summary.setWrapText(true);
        getChildren().addAll(title, summary, rows);
        setVgrow(rows, Priority.ALWAYS);
    }

    public void bind(WorldPlannerSourceMainContentModel model) {
        WorldPlannerSourceMainContentModel safeModel = Objects.requireNonNull(model, "model");
        safeModel.projectionProperty().addListener((observable, oldValue, newValue) -> render(newValue));
        render(safeModel.projectionProperty().get());
    }

    private void render(WorldPlannerSourceMainContentModel.Projection projection) {
        setVisible(projection.active());
        setManaged(projection.active());
        summary.setText(projection.summary());
        rows.getItems().setAll(projection.rows());
    }
}
