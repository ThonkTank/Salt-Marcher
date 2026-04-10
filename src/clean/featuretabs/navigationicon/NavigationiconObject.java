package clean.featuretabs.navigationicon;

import clean.featuretabs.navigationicon.input.ComposeNavigationiconInput;
import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Line;
import javafx.scene.shape.Polygon;
import javafx.scene.shape.Polyline;
import javafx.scene.shape.Rectangle;

/**
 * Clean-local mirror of the legacy shell navigation icon set.
 */
@SuppressWarnings("unused")
public final class NavigationiconObject {

    private final ComposeNavigationiconInput.NavigationiconInput navigationicon;

    public NavigationiconObject(ComposeNavigationiconInput input) {
        ComposeNavigationiconInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.navigationicon = new NavigationiconAssembly(resolvedInput).composeNavigationicon();
    }

    public ComposeNavigationiconInput.NavigationiconInput composeNavigationicon(ComposeNavigationiconInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return navigationicon;
    }

    private static final class NavigationiconAssembly {

        private NavigationiconAssembly(ComposeNavigationiconInput input) {
        }

        private ComposeNavigationiconInput.NavigationiconInput composeNavigationicon() {
            return new ComposeNavigationiconInput.NavigationiconInput(
                    encounter(),
                    travel(),
                    mapEditor(),
                    tables(),
                    spells()
            );
        }

        private static Node encounter() {
            Line bladeA = strokeLine(5, 4, 13, 14);
            Line bladeB = strokeLine(13, 4, 5, 14);
            Line hiltA = strokeLine(4, 10, 8, 6);
            Line hiltB = strokeLine(10, 6, 14, 10);
            return wrap(bladeA, bladeB, hiltA, hiltB);
        }

        private static Node travel() {
            Polygon hex = new Polygon(9, 2, 15, 5.5, 15, 12.5, 9, 16, 3, 12.5, 3, 5.5);
            applyStrokeStyle(hex);

            Polyline route = new Polyline(5, 11, 7.5, 8.5, 10, 10, 13, 6);
            applyStrokeStyle(route);

            Circle stop = new Circle(13, 6, 1.6);
            applyFillStyle(stop);
            return wrap(hex, route, stop);
        }

        private static Node mapEditor() {
            Polygon hex = new Polygon(8, 3, 13, 6, 13, 12, 8, 15, 3, 12, 3, 6);
            applyStrokeStyle(hex);

            Line pencilBody = strokeLine(6, 12, 13, 5);
            Line pencilTip = strokeLine(12.2, 4.2, 14.5, 2);
            return wrap(hex, pencilBody, pencilTip);
        }

        private static Node tables() {
            Rectangle page = new Rectangle(4, 2.5, 10, 13);
            applyStrokeStyle(page);
            page.setArcWidth(2);
            page.setArcHeight(2);

            Line row1 = strokeLine(6, 6, 12, 6);
            Line row2 = strokeLine(6, 9, 12, 9);
            Line row3 = strokeLine(6, 12, 12, 12);
            return wrap(page, row1, row2, row3);
        }

        private static Node spells() {
            Polyline spark = new Polyline(
                    9, 2.5,
                    10.5, 7.5,
                    15.5, 9,
                    10.5, 10.5,
                    9, 15.5,
                    7.5, 10.5,
                    2.5, 9,
                    7.5, 7.5,
                    9, 2.5
            );
            applyStrokeStyle(spark);

            Circle core = new Circle(9, 9, 1.7);
            applyFillStyle(core);
            return wrap(spark, core);
        }

        private static StackPane wrap(Node... nodes) {
            StackPane pane = new StackPane(nodes);
            pane.setMinSize(18, 18);
            pane.setPrefSize(18, 18);
            pane.setMaxSize(18, 18);
            pane.setMouseTransparent(true);
            return pane;
        }

        private static Line strokeLine(double startX, double startY, double endX, double endY) {
            Line line = new Line(startX, startY, endX, endY);
            applyStrokeStyle(line);
            return line;
        }

        private static void applyStrokeStyle(javafx.scene.shape.Shape shape) {
            shape.getProperties().put("clean-nav-role", "stroke");
            shape.setStrokeWidth(1.8);
            shape.setStrokeLineCap(javafx.scene.shape.StrokeLineCap.ROUND);
            shape.setStrokeLineJoin(javafx.scene.shape.StrokeLineJoin.ROUND);
            shape.setStroke(Color.web("#a4a7ab"));
            shape.setFill(null);
        }

        private static void applyFillStyle(javafx.scene.shape.Shape shape) {
            shape.getProperties().put("clean-nav-role", "fill");
            shape.setFill(Color.web("#a4a7ab"));
        }
    }
}
