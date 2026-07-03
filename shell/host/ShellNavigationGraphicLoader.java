package shell.host;

import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javafx.scene.Node;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;
import org.jspecify.annotations.Nullable;
import org.w3c.dom.Document;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import shell.api.NavigationGraphicResource;

/**
 * Loads bundled SVG navigation resources into JavaFX nodes for the shell.
 */
final class ShellNavigationGraphicLoader {

    private static final double DEFAULT_SIZE = 18.0;

    private ShellNavigationGraphicLoader() {
        throw new AssertionError("No instances");
    }

    static Node load(@Nullable NavigationGraphicResource resource) {
        if (resource == null) {
            return missingGraphic();
        }
        try (InputStream input = ShellNavigationGraphicLoader.class.getResourceAsStream(resource.path())) {
            if (input == null) {
                return missingGraphic();
            }
            Document document = parse(input);
            return render(document);
        } catch (IllegalArgumentException | IOException | ParserConfigurationException | SAXException exception) {
            return missingGraphic();
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
        return ShellNavigationSvgRenderer.render(document, ShellNavigationGraphicLoader::missingGraphic);
    }

    private static StackPane iconPane() {
        StackPane pane = new StackPane();
        ShellFx.addStyleClass(pane, "nav-icon");
        pane.setMinSize(DEFAULT_SIZE, DEFAULT_SIZE);
        pane.setPrefSize(DEFAULT_SIZE, DEFAULT_SIZE);
        pane.setMaxSize(DEFAULT_SIZE, DEFAULT_SIZE);
        pane.setMouseTransparent(true);
        return pane;
    }

    private static Node missingGraphic() {
        StackPane pane = iconPane();
        ShellFx.addStyleClass(pane, "nav-icon-missing");

        Rectangle frame = new Rectangle(3.0, 3.0, 12.0, 12.0);
        ShellFx.addStyleClass(frame, "nav-icon-missing-frame");
        Line slashA = new Line(4.5, 4.5, 13.5, 13.5);
        ShellFx.addStyleClass(slashA, "nav-icon-missing-stroke");
        Line slashB = new Line(13.5, 4.5, 4.5, 13.5);
        ShellFx.addStyleClass(slashB, "nav-icon-missing-stroke");
        ShellFx.addChildren(pane, frame, slashA, slashB);
        return pane;
    }

}
