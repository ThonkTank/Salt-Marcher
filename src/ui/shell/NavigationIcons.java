package ui.shell;

import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Line;
import javafx.scene.shape.Polygon;
import javafx.scene.shape.Polyline;
import javafx.scene.shape.Rectangle;
import javafx.scene.shape.Shape;

public final class NavigationIcons {

    private NavigationIcons() {
    }

    public static Node encounter() {
        Line bladeA = strokeLine(5, 4, 13, 14);
        Line bladeB = strokeLine(13, 4, 5, 14);
        Line hiltA = strokeLine(4, 10, 8, 6);
        Line hiltB = strokeLine(10, 6, 14, 10);
        return wrap(bladeA, bladeB, hiltA, hiltB);
    }

    public static Node overworld() {
        Polygon hex = new Polygon(9, 2, 15, 5.5, 15, 12.5, 9, 16, 3, 12.5, 3, 5.5);
        hex.getStyleClass().add("nav-icon-stroke");
        hex.setFill(null);

        Polyline route = new Polyline(5, 11, 7.5, 8.5, 10, 10, 13, 6);
        route.getStyleClass().add("nav-icon-stroke");
        route.setFill(null);

        Circle stop = new Circle(13, 6, 1.6);
        stop.getStyleClass().add("nav-icon-fill");
        return wrap(hex, route, stop);
    }

    public static Node dungeon() {
        Rectangle outer = new Rectangle(3, 3, 12, 12);
        outer.getStyleClass().add("nav-icon-stroke");
        outer.setArcWidth(2);
        outer.setArcHeight(2);
        outer.setFill(null);

        Line wallV = strokeLine(9, 3, 9, 11);
        Line wallH = strokeLine(3, 9, 12, 9);
        Line door = strokeLine(12, 9, 15, 9);
        return wrap(outer, wallV, wallH, door);
    }

    public static Node mapEditor() {
        Polygon hex = new Polygon(8, 3, 13, 6, 13, 12, 8, 15, 3, 12, 3, 6);
        hex.getStyleClass().add("nav-icon-stroke");
        hex.setFill(null);

        Line pencilBody = strokeLine(6, 12, 13, 5);
        Line pencilTip = strokeLine(12.2, 4.2, 14.5, 2);
        return wrap(hex, pencilBody, pencilTip);
    }

    public static Node dungeonEditor() {
        Rectangle cellA = filledRect(3, 3, 5, 5);
        Rectangle cellB = filledRect(10, 3, 5, 5);
        Rectangle cellC = filledRect(3, 10, 5, 5);
        Rectangle cellD = new Rectangle(10, 10, 5, 5);
        cellD.getStyleClass().add("nav-icon-stroke");
        cellD.setFill(null);

        Line tool = strokeLine(11, 14, 15, 10);
        return wrap(cellA, cellB, cellC, cellD, tool);
    }

    public static Node tables() {
        Rectangle page = new Rectangle(4, 2.5, 10, 13);
        page.getStyleClass().add("nav-icon-stroke");
        page.setArcWidth(2);
        page.setArcHeight(2);
        page.setFill(null);

        Line row1 = strokeLine(6, 6, 12, 6);
        Line row2 = strokeLine(6, 9, 12, 9);
        Line row3 = strokeLine(6, 12, 12, 12);
        return wrap(page, row1, row2, row3);
    }

    public static Node spells() {
        Polyline sparkA = new Polyline(9, 2.5, 10.5, 7.5, 15.5, 9, 10.5, 10.5, 9, 15.5, 7.5, 10.5, 2.5, 9, 7.5, 7.5, 9, 2.5);
        sparkA.getStyleClass().add("nav-icon-stroke");
        sparkA.setFill(null);

        Circle core = new Circle(9, 9, 1.7);
        core.getStyleClass().add("nav-icon-fill");
        return wrap(sparkA, core);
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

    private static Line strokeLine(double startX, double startY, double endX, double endY) {
        Line line = new Line(startX, startY, endX, endY);
        line.getStyleClass().add("nav-icon-stroke");
        return line;
    }

    private static Rectangle filledRect(double x, double y, double width, double height) {
        Rectangle rect = new Rectangle(x, y, width, height);
        rect.getStyleClass().add("nav-icon-fill");
        return rect;
    }
}
