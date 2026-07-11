package shell.host;

import java.util.Arrays;
import java.util.function.Supplier;
import javafx.scene.Group;
import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

final class ShellNavigationSvgRenderer {

    private static final double DEFAULT_SIZE = 18.0;

    private ShellNavigationSvgRenderer() {
    }

    static Node render(Document document, Supplier<Node> missingGraphic) {
        Element root = document.getDocumentElement();
        StackPane pane = iconPane();
        applyStyleClasses(pane, root.getAttribute("class"));
        SvgIconGroup icon = new SvgIconGroup();
        NodeList nodes = root.getChildNodes();
        int renderedChildren = 0;
        for (int index = 0; index < nodes.getLength(); index++) {
            org.w3c.dom.Node child = nodes.item(index);
            if (child instanceof Element element) {
                renderedChildren += addSvgElement(icon, element);
            }
        }
        if (renderedChildren == 0) {
            return missingGraphic.get();
        }
        addViewBoxTransform(icon, ShellNavigationSvgViewBox.from(root, DEFAULT_SIZE));
        pane.getChildren().add(icon);
        return pane;
    }

    private static int addSvgElement(SvgIconGroup icon, Element element) {
        Node graphic = ShellNavigationSvgNodeFactory.createNode(element);
        if (graphic == null) {
            return 0;
        }
        String classAttribute = element.getAttribute("class");
        if (classAttribute == null || classAttribute.isBlank()) {
            graphic.getStyleClass().add("nav-icon-stroke");
        } else {
            applyStyleClasses(graphic, classAttribute);
        }
        icon.addGraphic(graphic);
        return 1;
    }

    private static void addViewBoxTransform(SvgIconGroup icon, ShellNavigationSvgViewBox viewBox) {
        icon.applyViewBox(viewBox);
    }

    private static StackPane iconPane() {
        StackPane pane = new StackPane();
        pane.getStyleClass().add("nav-icon");
        pane.setMinSize(DEFAULT_SIZE, DEFAULT_SIZE);
        pane.setPrefSize(DEFAULT_SIZE, DEFAULT_SIZE);
        pane.setMaxSize(DEFAULT_SIZE, DEFAULT_SIZE);
        pane.setMouseTransparent(true);
        return pane;
    }

    private static void applyStyleClasses(Node node, String classAttribute) {
        if (classAttribute == null || classAttribute.isBlank()) {
            return;
        }
        Arrays.stream(classAttribute.trim().split("\\s+"))
                .filter(styleClass -> !styleClass.isBlank())
                .forEach(styleClass -> node.getStyleClass().add(styleClass));
    }

    private static final class SvgIconGroup extends Group {

        private void addGraphic(Node graphic) {
            getChildren().add(graphic);
        }

        private void applyViewBox(ShellNavigationSvgViewBox viewBox) {
            getTransforms().add(viewBox.toIconTransform());
        }
    }
}
