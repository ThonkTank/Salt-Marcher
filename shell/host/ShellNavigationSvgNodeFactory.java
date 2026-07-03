package shell.host;

import java.util.Arrays;
import javafx.scene.Node;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Line;
import javafx.scene.shape.Polygon;
import javafx.scene.shape.Polyline;
import javafx.scene.shape.Rectangle;
import javafx.scene.shape.SVGPath;
import org.jspecify.annotations.Nullable;
import org.w3c.dom.Element;

final class ShellNavigationSvgNodeFactory {

    private ShellNavigationSvgNodeFactory() {
    }

    static @Nullable Node createNode(Element element) {
        return switch (element.getTagName()) {
            case "circle" -> new Circle(
                    doubleAttribute(element, "cx"),
                    doubleAttribute(element, "cy"),
                    doubleAttribute(element, "r"));
            case "line" -> new Line(
                    doubleAttribute(element, "x1"),
                    doubleAttribute(element, "y1"),
                    doubleAttribute(element, "x2"),
                    doubleAttribute(element, "y2"));
            case "path" -> path(element);
            case "polygon" -> polygon(element);
            case "polyline" -> polyline(element);
            case "rect" -> rectangle(element);
            default -> null;
        };
    }

    private static SVGPath path(Element element) {
        SVGPath path = new SVGPath();
        path.setContent(element.getAttribute("d"));
        return path;
    }

    private static Polygon polygon(Element element) {
        Polygon polygon = new Polygon();
        addPointValues(polygon.getPoints(), element.getAttribute("points"));
        return polygon;
    }

    private static Polyline polyline(Element element) {
        Polyline polyline = new Polyline();
        addPointValues(polyline.getPoints(), element.getAttribute("points"));
        return polyline;
    }

    private static Rectangle rectangle(Element element) {
        Rectangle rectangle = new Rectangle(
                doubleAttribute(element, "x"),
                doubleAttribute(element, "y"),
                doubleAttribute(element, "width"),
                doubleAttribute(element, "height"));
        double radiusX = doubleAttribute(element, "rx");
        double radiusY = doubleAttribute(element, "ry");
        if (radiusX > 0.0 || radiusY > 0.0) {
            double arcWidth = radiusX > 0.0 ? radiusX * 2.0 : radiusY * 2.0;
            double arcHeight = radiusY > 0.0 ? radiusY * 2.0 : radiusX * 2.0;
            rectangle.setArcWidth(arcWidth);
            rectangle.setArcHeight(arcHeight);
        }
        return rectangle;
    }

    private static double doubleAttribute(Element element, String name) {
        String value = element.getAttribute(name);
        if (value == null || value.isBlank()) {
            return 0.0;
        }
        return Double.parseDouble(value);
    }

    private static void addPointValues(javafx.collections.ObservableList<Double> points, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        Arrays.stream(value.trim().split("[,\\s]+"))
                .filter(point -> !point.isBlank())
                .map(Double::parseDouble)
                .forEach(points::add);
    }
}
