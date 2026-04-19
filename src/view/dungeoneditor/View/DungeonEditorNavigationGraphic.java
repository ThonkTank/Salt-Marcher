package src.view.dungeoneditor.View;

import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;

public final class DungeonEditorNavigationGraphic {

    private DungeonEditorNavigationGraphic() {
    }

    public static Node create() {
        Rectangle cellA = filledRect(3, 3, 5, 5);
        Rectangle cellB = filledRect(10, 3, 5, 5);
        Rectangle cellC = filledRect(3, 10, 5, 5);
        Rectangle cellD = new Rectangle(10, 10, 5, 5);
        cellD.getStyleClass().add("nav-icon-stroke");

        Line tool = new Line(11, 14, 15, 10);
        tool.getStyleClass().add("nav-icon-stroke");
        return wrap(cellA, cellB, cellC, cellD, tool);
    }

    private static Rectangle filledRect(double x, double y, double width, double height) {
        Rectangle rect = new Rectangle(x, y, width, height);
        rect.getStyleClass().add("nav-icon-fill");
        return rect;
    }

    private static StackPane wrap(Node... nodes) {
        StackPane pane = new StackPane(nodes);
        pane.getStyleClass().add("nav-icon");
        pane.setMinSize(18, 18);
        pane.setPrefSize(18, 18);
        pane.setMaxSize(18, 18);
        pane.setMouseTransparent(true);
        return pane;
    }
}
