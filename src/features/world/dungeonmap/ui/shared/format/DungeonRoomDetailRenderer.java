package features.world.dungeonmap.ui.shared.format;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;
import javafx.application.Platform;
import javafx.geometry.Bounds;
import javafx.scene.Node;
import javafx.scene.control.Hyperlink;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.scene.text.TextFlow;

import java.util.ArrayList;
import java.util.List;

public final class DungeonRoomDetailRenderer {

    private DungeonRoomDetailRenderer() {
    }

    public static void appendStructuredDetails(VBox parent, DungeonMapIndex index, DungeonRoom room, String areaName) {
        if (parent == null || room == null || index == null) {
            return;
        }

        parent.getStyleClass().add("dungeon-gm-card");
        parent.getChildren().add(title(formatRoomTitle(room)));
        if (areaName != null && !areaName.isBlank()) {
            parent.getChildren().add(secondary("Bereich: " + areaName.trim()));
        }
        parent.getChildren().add(separator());

        List<DungeonFeature> features = DungeonRoomFeatureOrder.orderedRoomFeatures(index, room.roomId());
        appendIntroSection(parent, room, features);
        appendFeatureSections(parent, features);
    }

    private static void appendIntroSection(VBox parent, DungeonRoom room, List<DungeonFeature> features) {
        VBox section = new VBox(8);
        section.getStyleClass().add("dungeon-detail-section");
        appendRoomBriefing(section, room);
        appendFeatureGlanceBriefing(section, features);
        appendSupportBlock(section, "Mechanische Effekte", room.reactiveChecks());
        appendSupportBlock(section, "GM-Details", room.gmBackground());
        parent.getChildren().add(section);
        parent.getChildren().add(separator());
    }

    private static void appendRoomBriefing(VBox parent, DungeonRoom room) {
        String description = composeRoomDescription(room);
        if (description == null) {
            return;
        }
        Label briefing = bodyLabel(description);
        briefing.getStyleClass().add("dungeon-room-briefing");
        parent.getChildren().add(briefing);
    }

    private static void appendFeatureGlanceBriefing(VBox parent, List<DungeonFeature> features) {
        TextFlow flow = new TextFlow();
        flow.getStyleClass().add("dungeon-feature-glance-flow");
        boolean hasContent = false;
        for (DungeonFeature feature : features) {
            String glance = normalized(feature.glanceDescription());
            if (glance == null) {
                continue;
            }
            if (hasContent) {
                flow.getChildren().add(new Text(" "));
            }
            Hyperlink link = new Hyperlink(glance);
            link.getStyleClass().add("dungeon-feature-glance-link");
            link.setOnAction(event -> scrollToAnchor(link, featureAnchorId(feature)));
            flow.getChildren().add(link);
            hasContent = true;
        }
        if (hasContent) {
            parent.getChildren().add(flow);
        }
    }

    private static void appendSupportBlock(VBox parent, String labelText, String body) {
        if (body == null || body.isBlank()) {
            return;
        }
        TextFlow flow = new TextFlow();
        flow.getStyleClass().add("dungeon-support-flow");
        Text label = new Text(labelText + ": ");
        label.getStyleClass().add("dungeon-support-label");
        Text content = new Text(body.trim());
        content.getStyleClass().add("dungeon-support-body");
        flow.getChildren().addAll(label, content);
        parent.getChildren().add(flow);
    }

    private static void appendFeatureSections(VBox parent, List<DungeonFeature> features) {
        boolean renderedFeature = false;
        for (DungeonFeature feature : features) {
            VBox content = new VBox(4);
            content.getStyleClass().add("dungeon-feature-block");
            Label title = sectionHeader(featureLabel(feature));
            title.getStyleClass().add("dungeon-feature-block-title");
            title.setId(featureAnchorId(feature));
            content.getChildren().add(title);
            appendFeatureParagraph(content, feature.glanceDescription());
            appendFeatureParagraph(content, feature.detailDescription());
            appendSupportBlock(content, "Mechanische Effekte", feature.reactiveChecks());
            appendSupportBlock(content, "GM-Details", feature.gmBackground());
            if (content.getChildren().size() == 1) {
                continue;
            }
            if (renderedFeature) {
                parent.getChildren().add(separator());
            }
            parent.getChildren().add(content);
            renderedFeature = true;
        }
    }

    private static void appendFeatureParagraph(VBox parent, String body) {
        if (body == null || body.isBlank()) {
            return;
        }
        Label value = bodyLabel(body.trim());
        value.getStyleClass().add("dungeon-feature-block-body");
        parent.getChildren().add(value);
    }

    private static Label title(String value) {
        Label label = new Label(value);
        label.getStyleClass().add("dungeon-gm-title");
        label.setWrapText(true);
        VBox.setVgrow(label, Priority.NEVER);
        return label;
    }

    private static Label secondary(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("dungeon-gm-meta");
        label.setWrapText(true);
        return label;
    }

    private static Label bodyLabel(String body) {
        Label label = new Label(body);
        label.getStyleClass().add("dungeon-detail-action-body");
        label.setWrapText(true);
        return label;
    }

    private static Label sectionHeader(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("stat-block-section-header");
        label.setWrapText(true);
        return label;
    }

    private static Region separator() {
        Region separator = new Region();
        separator.getStyleClass().add("stat-block-separator");
        separator.setMinHeight(2);
        separator.setPrefHeight(2);
        separator.setMaxHeight(2);
        return separator;
    }

    private static String featureLabel(DungeonFeature feature) {
        if (feature == null) {
            return "Feature";
        }
        String name = feature.name();
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        DungeonFeatureCategory category = feature.category() == null ? DungeonFeatureCategory.CURIOSITY : feature.category();
        return category.label();
    }

    private static String featureAnchorId(DungeonFeature feature) {
        return "dungeon-feature-" + (feature == null || feature.featureId() == null ? "new" : feature.featureId());
    }

    private static String composeRoomDescription(DungeonRoom room) {
        List<String> parts = new ArrayList<>();
        addComposedPart(parts, room.lightLevel());
        addComposedPart(parts, room.visualDescription());
        addComposedPart(parts, room.soundsDescription());
        addComposedPart(parts, room.smellsDescription());
        addComposedPart(parts, room.otherDescription());
        if (parts.isEmpty()) {
            return null;
        }
        return String.join(" ", parts);
    }

    private static void addComposedPart(List<String> parts, String body) {
        String normalized = normalized(body);
        if (normalized == null) {
            return;
        }
        parts.add(ensureSentenceTerminator(normalized));
    }

    private static void scrollToAnchor(Node source, String anchorId) {
        if (source == null || anchorId == null || source.getScene() == null) {
            return;
        }
        Platform.runLater(() -> {
            ScrollPane scrollPane = findAncestorScrollPane(source);
            if (scrollPane == null || scrollPane.getContent() == null) {
                return;
            }
            Node anchor = source.getScene().lookup("#" + anchorId);
            if (anchor == null) {
                return;
            }
            Bounds targetBounds = scrollPane.getContent().sceneToLocal(anchor.localToScene(anchor.getBoundsInLocal()));
            double contentHeight = scrollPane.getContent().getBoundsInLocal().getHeight();
            double viewportHeight = scrollPane.getViewportBounds().getHeight();
            if (contentHeight <= viewportHeight) {
                scrollPane.setVvalue(0);
                return;
            }
            double targetY = Math.max(0, targetBounds.getMinY() - 12);
            scrollPane.setVvalue(Math.max(0, Math.min(1, targetY / (contentHeight - viewportHeight))));
        });
    }

    private static ScrollPane findAncestorScrollPane(Node node) {
        Node current = node;
        while (current != null) {
            if (current instanceof ScrollPane scrollPane) {
                return scrollPane;
            }
            current = current.getParent();
        }
        return null;
    }

    private static String normalized(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String ensureSentenceTerminator(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        char lastChar = value.charAt(value.length() - 1);
        if (lastChar == '.' || lastChar == '!' || lastChar == '?') {
            return value;
        }
        return value + ".";
    }

    private static String formatRoomTitle(DungeonRoom room) {
        String title = room.name() == null || room.name().isBlank() ? "Raum" : room.name().trim();
        return room.roomId() == null ? title : room.roomId() + ": " + title;
    }
}
