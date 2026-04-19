package src.view.dungeontravel.View;

import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;

public final class DungeonTravelNavigationGraphic {

    private DungeonTravelNavigationGraphic() {
    }

    public static Node create() {
        Rectangle outer = new Rectangle(3, 3, 12, 12);
        outer.getStyleClass().add("nav-icon-stroke");
        outer.setArcWidth(2);
        outer.setArcHeight(2);

        Line wallV = new Line(9, 3, 9, 11);
        Line wallH = new Line(3, 9, 12, 9);
        Line door = new Line(12, 9, 15, 9);
        wallV.getStyleClass().add("nav-icon-stroke");
        wallH.getStyleClass().add("nav-icon-stroke");
        door.getStyleClass().add("nav-icon-stroke");
        return wrap(outer, wallV, wallH, door);
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
