package saltmarcher.quality.viewview.fxml;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import javax.xml.XMLConstants;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

final class ViewFxmlResourceChecker {

    private static final List<String> ACTIVE_RESOURCE_AREAS = List.of("leftbartabs", "statetabs", "dropdowns");
    private static final List<String> SLOTCONTENT_RESOURCE_AREAS = List.of(
            "controls", "main", "state", "details", "topbar", "primitives");
    private static final String FXML_NAMESPACE = "http://javafx.com/fxml";
    private static final Pattern SCRIPT_PROCESSING_INSTRUCTION_PATTERN =
            Pattern.compile("<\\?\\s*(language|compile)\\b", Pattern.CASE_INSENSITIVE);

    List<String> check(Path projectRoot) throws IOException {
        Path normalizedProjectRoot = projectRoot.normalize();
        Path resourcesRoot = normalizedProjectRoot.resolve("resources").normalize();
        Path expectedRoot = resourcesRoot.resolve("view").normalize();
        List<String> violations = new ArrayList<>();

        try (var paths = Files.walk(normalizedProjectRoot)) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".fxml"))
                    .forEach(path -> {
                        String relative = normalizedProjectRoot.relativize(path).toString().replace('\\', '/');
                        List<String> viewResourceSegments = path.startsWith(expectedRoot)
                                ? pathSegments(expectedRoot.relativize(path))
                                : List.of();
                        validatePlacement(path, expectedRoot, relative, violations);
                        validateContent(path, relative, viewResourceSegments, violations);
                    });
        }
        return violations;
    }

    private void validatePlacement(Path path, Path expectedRoot, String relative, List<String> violations) {
        if (!path.startsWith(expectedRoot) || path.getParent() == null || path.getParent().getFileName() == null) {
            violations.add(relative + " -> expected resources/view/{leftbartabs,statetabs,dropdowns}/<entry>/*.fxml or "
                    + "resources/view/slotcontent/<slot>/<entry>/*.fxml");
            return;
        }
        List<String> rootRelative = pathSegments(expectedRoot.relativize(path));
        if (!hasAllowedViewResourceRoot(rootRelative)) {
            violations.add(relative + " -> expected resources/view/{leftbartabs,statetabs,dropdowns}/<entry>/*.fxml or "
                    + "resources/view/slotcontent/<slot>/<entry>/*.fxml");
        }
        if (!Files.isDirectory(path.getParent())) {
            violations.add(relative + " -> parent directory is not a readable passive-view resource directory");
        }
    }

    private void validateContent(Path file, String relative, List<String> viewResourceSegments, List<String> violations) {
        String text;
        try {
            text = Files.readString(file);
        } catch (IOException exception) {
            violations.add(relative + " -> unable to read FXML: " + exception.getMessage());
            return;
        }
        if (SCRIPT_PROCESSING_INSTRUCTION_PATTERN.matcher(text).find()) {
            violations.add(relative + " -> script-related FXML processing instructions are forbidden");
        }
        FxmlMetadata metadata = parseFxmlMetadata(file, relative, violations);
        if (metadata == null) {
            return;
        }
        if (metadata.inlineScriptElementPresent) {
            violations.add(relative + " -> inline FXML script elements are forbidden");
        }
        if (metadata.scriptEventHandlerPresent) {
            violations.add(relative + " -> script-based FXML event handler attributes are forbidden");
        }
        if (metadata.nestedFxControllerPresent) {
            violations.add(relative + " -> fx:controller is allowed only on the root element");
        }
        if (metadata.rootController == null) {
            return;
        }
        List<String> allowedPrefixes = List.of(
                "src.view.leftbartabs.",
                "src.view.statetabs.",
                "src.view.dropdowns.",
                "src.view.slotcontent.");
        if (allowedPrefixes.stream().noneMatch(metadata.rootController::startsWith)) {
            violations.add(relative + " -> fx:controller must start with one of " + String.join(", ", allowedPrefixes));
            return;
        }
        validateControllerName(metadata.rootController, relative, viewResourceSegments, violations);
    }

    private void validateControllerName(
            String controller,
            String relative,
            List<String> viewResourceSegments,
            List<String> violations) {
        List<String> controllerSegments = List.of(controller.split("\\."));
        if (controllerSegments.size() < 4
                || !"src".equals(controllerSegments.get(0))
                || !"view".equals(controllerSegments.get(1))) {
            violations.add(relative + " -> fx:controller must point to a concrete src.view passive View class");
            return;
        }
        String area = controllerSegments.get(2);
        String simpleName = controllerSegments.get(controllerSegments.size() - 1).split("\\$")[0];
        boolean validController = switch (area) {
            case "slotcontent" -> controllerSegments.size() == 6
                    && simpleName.endsWith("View")
                    && !simpleName.endsWith("ViewModel");
            case "leftbartabs" -> controllerSegments.size() == 5
                    && (simpleName.endsWith("ControlsView")
                    || simpleName.endsWith("MainView")
                    || simpleName.endsWith("StateView"));
            case "dropdowns" -> controllerSegments.size() == 5 && simpleName.endsWith("TopBarView");
            case "statetabs" -> controllerSegments.size() == 5 && simpleName.endsWith("StateView");
            default -> false;
        };
        if (!validController) {
            violations.add(relative + " -> fx:controller must match its passive view area: leftbartabs use "
                    + "*ControlsView/*MainView/*StateView, dropdowns use *TopBarView, statetabs use *StateView, "
                    + "slotcontent uses *View");
        }
        validateControllerPathAlignment(controllerSegments, simpleName, viewResourceSegments, relative, violations);
    }

    private void validateControllerPathAlignment(
            List<String> controllerSegments,
            String simpleName,
            List<String> viewResourceSegments,
            String relative,
            List<String> violations) {
        if (!hasAllowedViewResourceRoot(viewResourceSegments)) {
            return;
        }
        String fileBaseName = viewResourceSegments.get(viewResourceSegments.size() - 1).replaceFirst("\\.fxml$", "");
        if (!simpleName.equals(fileBaseName)) {
            violations.add(relative + " -> fx:controller simple class '" + simpleName
                    + "' must match FXML file basename '" + fileBaseName + "'");
        }

        List<String> expectedPackageSegments = "slotcontent".equals(viewResourceSegments.get(0))
                ? List.of("src", "view", "slotcontent", viewResourceSegments.get(1), viewResourceSegments.get(2))
                : List.of("src", "view", viewResourceSegments.get(0), viewResourceSegments.get(1));
        if (!controllerSegments.subList(0, controllerSegments.size() - 1).equals(expectedPackageSegments)) {
            violations.add(relative + " -> fx:controller package must match resource path: "
                    + String.join(".", expectedPackageSegments) + "." + fileBaseName);
        }
    }

    private FxmlMetadata parseFxmlMetadata(Path file, String relative, List<String> violations) {
        XMLInputFactory inputFactory = XMLInputFactory.newFactory();
        inputFactory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        inputFactory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        try (var input = Files.newInputStream(file)) {
            XMLStreamReader reader = inputFactory.createXMLStreamReader(input);
            boolean rootSeen = false;
            String rootController = null;
            boolean nestedFxControllerPresent = false;
            boolean inlineScriptElementPresent = false;
            boolean scriptEventHandlerPresent = false;
            while (reader.hasNext()) {
                if (reader.next() == XMLStreamConstants.START_ELEMENT) {
                    String namespaceUri = reader.getNamespaceURI() == null ? "" : reader.getNamespaceURI();
                    String localName = reader.getLocalName();
                    if (!rootSeen) {
                        rootSeen = true;
                        rootController = attributeValue(reader, FXML_NAMESPACE, "controller");
                    } else if (attributeValue(reader, FXML_NAMESPACE, "controller") != null) {
                        nestedFxControllerPresent = true;
                    }
                    if (isScriptElement(namespaceUri, localName)) {
                        inlineScriptElementPresent = true;
                    }
                    if (hasScriptEventHandler(reader)) {
                        scriptEventHandlerPresent = true;
                    }
                }
            }
            return new FxmlMetadata(
                    rootController,
                    nestedFxControllerPresent,
                    inlineScriptElementPresent,
                    scriptEventHandlerPresent);
        } catch (XMLStreamException | IOException exception) {
            violations.add(relative + " -> invalid FXML/XML: "
                    + (exception.getMessage() == null ? "parse failure" : exception.getMessage()));
            return null;
        }
    }

    private static String attributeValue(XMLStreamReader reader, String namespaceUri, String localName) {
        return reader.getAttributeValue(namespaceUri, localName);
    }

    private static boolean isScriptElement(String namespaceUri, String localName) {
        return "script".equals(localName) && (namespaceUri.isBlank() || FXML_NAMESPACE.equals(namespaceUri));
    }

    private static boolean hasScriptEventHandler(XMLStreamReader reader) {
        for (int index = 0; index < reader.getAttributeCount(); index++) {
            String attributeNamespace = reader.getAttributeNamespace(index) == null
                    ? ""
                    : reader.getAttributeNamespace(index);
            if (XMLConstants.XMLNS_ATTRIBUTE_NS_URI.equals(attributeNamespace)) {
                continue;
            }
            String attributeLocalName = reader.getAttributeLocalName(index);
            if (!attributeLocalName.startsWith("on")) {
                continue;
            }
            String value = reader.getAttributeValue(index) == null
                    ? ""
                    : reader.getAttributeValue(index).trim();
            if (!value.isEmpty() && !value.startsWith("#") && !value.startsWith("$")) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasAllowedViewResourceRoot(List<String> segments) {
        if (segments.size() < 2) {
            return false;
        }
        if ("slotcontent".equals(segments.get(0))) {
            return segments.size() == 4 && SLOTCONTENT_RESOURCE_AREAS.contains(segments.get(1));
        }
        return ACTIVE_RESOURCE_AREAS.contains(segments.get(0)) && segments.size() == 3;
    }

    private static List<String> pathSegments(Path path) {
        List<String> segments = new ArrayList<>();
        for (Path segment : path) {
            segments.add(segment.toString());
        }
        return segments;
    }

    private record FxmlMetadata(
            String rootController,
            boolean nestedFxControllerPresent,
            boolean inlineScriptElementPresent,
            boolean scriptEventHandlerPresent) {
    }
}
