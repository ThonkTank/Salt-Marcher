package src.view.dungeonmap.api;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import src.view.dungeonmap.api.DungeonSelectionInspectorEntry;

public final class DungeonSelectionInspectorContent {

    private DungeonSelectionInspectorContent() {
    }

    public static Node build(DungeonSelectionInspectorEntry entry) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label title = new Label(entry.title());
        title.getStyleClass().add("bold");
        Label summary = new Label(entry.summary());
        summary.setWrapText(true);
        box.getChildren().addAll(title, summary);
        for (String fact : entry.facts()) {
            Label line = new Label(fact);
            line.setWrapText(true);
            box.getChildren().add(line);
        }
        return box;
    }
}
