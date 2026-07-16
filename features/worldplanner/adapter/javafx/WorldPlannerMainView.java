package features.worldplanner.adapter.javafx;

import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

public final class WorldPlannerMainView extends VBox {

    WorldPlannerMainView(
            Node npcMain,
            Node factionMain,
            Node locationMain,
            Node sourceMain
    ) {
        StackPane moduleStack = new StackPane(npcMain, factionMain, locationMain, sourceMain);
        moduleStack.getStyleClass().add("world-planner-main-stack");
        getChildren().add(moduleStack);
        setVgrow(moduleStack, Priority.ALWAYS);
    }

    public void bind(WorldPlannerViewModel viewModel) {
        if (viewModel != null) {
            setFillWidth(true);
        }
    }
}
