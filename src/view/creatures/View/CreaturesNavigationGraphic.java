package src.view.creatures.View;

import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;

public final class CreaturesNavigationGraphic {

    private CreaturesNavigationGraphic() {
    }

    public static Node create() {
        Rectangle page = new Rectangle(4, 2.5, 10, 13);
        page.getStyleClass().add("nav-icon-stroke");
        page.setArcWidth(2);
        page.setArcHeight(2);

        Line row1 = new Line(6, 6, 12, 6);
        Line row2 = new Line(6, 9, 12, 9);
        Line row3 = new Line(6, 12, 12, 12);
        row1.getStyleClass().add("nav-icon-stroke");
        row2.getStyleClass().add("nav-icon-stroke");
        row3.getStyleClass().add("nav-icon-stroke");
        return wrap(page, row1, row2, row3);
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
