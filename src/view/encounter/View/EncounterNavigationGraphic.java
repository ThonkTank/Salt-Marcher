package src.view.encounter.View;

import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;

public final class EncounterNavigationGraphic {

    private EncounterNavigationGraphic() {
    }

    public static Node create() {
        Line bladeA = new Line(5, 4, 13, 14);
        Line bladeB = new Line(13, 4, 5, 14);
        Line hiltA = new Line(4, 10, 8, 6);
        Line hiltB = new Line(10, 6, 14, 10);
        bladeA.getStyleClass().add("nav-icon-stroke");
        bladeB.getStyleClass().add("nav-icon-stroke");
        hiltA.getStyleClass().add("nav-icon-stroke");
        hiltB.getStyleClass().add("nav-icon-stroke");
        return wrap(bladeA, bladeB, hiltA, hiltB);
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
