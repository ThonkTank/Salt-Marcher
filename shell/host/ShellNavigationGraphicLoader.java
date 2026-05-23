package shell.host;

import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.util.Arrays;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;
import javafx.scene.shape.SVGPath;
import org.jspecify.annotations.Nullable;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import shell.api.NavigationGraphicResource;

/**
 * Loads simple SVG navigation resources into JavaFX nodes for the shell.
 */
final class ShellNavigationGraphicLoader {

    private static final double DEFAULT_SIZE = 18.0;

    private ShellNavigationGraphicLoader() {
        throw new AssertionError("No instances");
    }

    static @Nullable Node load(@Nullable NavigationGraphicResource resource) {
        if (resource == null) {
            return null;
        }
        try (InputStream input = ShellNavigationGraphicLoader.class.getResourceAsStream(resource.path())) {
            if (input == null) {
                return null;
            }
            Document document = parse(input);
            return render(document);
        } catch (IOException | ParserConfigurationException | SAXException exception) {
            return null;
        }
    }

    private static Document parse(InputStream input) throws ParserConfigurationException, SAXException, IOException {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setExpandEntityReferences(false);
        factory.setXIncludeAware(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        builder.setEntityResolver((publicId, systemId) -> new InputSource(new StringReader("")));
        return builder.parse(input);
    }

    private static Node render(Document document) {
        Element root = document.getDocumentElement();
        StackPane pane = new StackPane();
        applyStyleClasses(pane, root.getAttribute("class"));
        ShellFx.addStyleClass(pane, "nav-icon");
        pane.setMinSize(DEFAULT_SIZE, DEFAULT_SIZE);
        pane.setPrefSize(DEFAULT_SIZE, DEFAULT_SIZE);
        pane.setMaxSize(DEFAULT_SIZE, DEFAULT_SIZE);
        pane.setMouseTransparent(true);
        NodeList nodes = root.getChildNodes();
        for (int index = 0; index < nodes.getLength(); index++) {
            org.w3c.dom.Node child = nodes.item(index);
            if (child instanceof Element element) {
                addSvgElement(pane, element);
            }
        }
        return pane;
    }

    private static void addSvgElement(StackPane pane, Element element) {
        Node graphic = createNode(element);
        if (graphic == null) {
            return;
        }
        applyStyleClasses(graphic, element.getAttribute("class"));
        ShellFx.addChild(pane, graphic);
    }

    private static @Nullable Node createNode(Element element) {
        return switch (element.getTagName()) {
            case "line" -> createLine(element);
            case "rect" -> createRectangle(element);
            case "path" -> createPath(element);
            default -> null;
        };
    }

    private static Line createLine(Element element) {
        Line line = new Line(
                doubleAttribute(element, "x1"),
                doubleAttribute(element, "y1"),
                doubleAttribute(element, "x2"),
                doubleAttribute(element, "y2"));
        ShellFx.addStyleClass(line, "nav-icon-stroke");
        return line;
    }

    private static Rectangle createRectangle(Element element) {
        Rectangle rectangle = new Rectangle(
                doubleAttribute(element, "x"),
                doubleAttribute(element, "y"),
                doubleAttribute(element, "width"),
                doubleAttribute(element, "height"));
        ShellFx.addStyleClass(rectangle, "nav-icon-fill");
        return rectangle;
    }

    private static SVGPath createPath(Element element) {
        SVGPath path = new SVGPath();
        path.setContent(element.getAttribute("d"));
        ShellFx.addStyleClass(path, "nav-icon-fill");
        return path;
    }

    private static double doubleAttribute(Element element, String name) {
        String value = element.getAttribute(name);
        if (value == null || value.isBlank()) {
            return 0.0;
        }
        return Double.parseDouble(value);
    }

    private static void applyStyleClasses(Node node, String classAttribute) {
        if (classAttribute == null || classAttribute.isBlank()) {
            return;
        }
        Arrays.stream(classAttribute.trim().split("\\s+"))
                .filter(styleClass -> !styleClass.isBlank())
                .forEach(styleClass -> ShellFx.addStyleClass(node, styleClass));
    }
}
