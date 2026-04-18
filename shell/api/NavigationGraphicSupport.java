package shell.api;

import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;

/**
 * Generic JavaFX primitives for feature-owned navigation graphics.
 * Features still define the icon composition and register the supplier.
 */
public final class NavigationGraphicSupport {

    private NavigationGraphicSupport() {
        throw new AssertionError("No instances");
    }

    public static StackPane wrap(Node... nodes) {
        StackPane pane = new StackPane(nodes);
        pane.getStyleClass().add("nav-icon");
        pane.setMinSize(18, 18);
        pane.setPrefSize(18, 18);
        pane.setMaxSize(18, 18);
        pane.setMouseTransparent(true);
        return pane;
    }

    public static Line strokeLine(double startX, double startY, double endX, double endY) {
        Line line = new Line(startX, startY, endX, endY);
        line.getStyleClass().add("nav-icon-stroke");
        return line;
    }

    public static Rectangle filledRect(double x, double y, double width, double height) {
        Rectangle rect = new Rectangle(x, y, width, height);
        rect.getStyleClass().add("nav-icon-fill");
        return rect;
    }
}
