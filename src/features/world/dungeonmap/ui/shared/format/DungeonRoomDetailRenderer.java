package features.world.dungeonmap.ui.shared.format;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonRoomDetailRenderer {

    private DungeonRoomDetailRenderer() {
    }

    public static void appendStructuredDetails(VBox parent, DungeonMapIndex index, DungeonRoom room) {
        if (parent == null || room == null || index == null) {
            return;
        }

        parent.getChildren().add(title(formatRoomTitle(room)));

        List<DungeonFeature> features = DungeonRoomFeatureOrder.orderedRoomFeatures(index, room.roomId());
        appendParagraphSection(parent, "Auf den ersten Blick", buildGlanceParagraphs(room, features));
        // Reactive checks stay ahead of the element deep dives so the GM sees time-sensitive rolls first.
        appendNamedSection(parent, "Reaktive Checks", buildReactiveBlocks(room, features));
        appendNamedSection(parent, "Signifikante Elemente", buildElementBlocks(room, features));
        appendNamedSection(parent, "GM-Hintergrund", buildGmBlocks(room, features));
    }

    private static List<String> buildGlanceParagraphs(DungeonRoom room, List<DungeonFeature> features) {
        List<String> paragraphs = new ArrayList<>();
        addIfPresent(paragraphs, room.glanceDescription());
        for (DungeonFeature feature : features) {
            addIfPresent(paragraphs, feature.glanceDescription());
        }
        return paragraphs;
    }

    private static List<NamedBlock> buildReactiveBlocks(DungeonRoom room, List<DungeonFeature> features) {
        List<NamedBlock> blocks = new ArrayList<>();
        addNamedBlock(blocks, null, room.reactiveChecks());
        for (DungeonFeature feature : features) {
            addNamedBlock(blocks, feature.toString(), feature.reactiveChecks());
        }
        return blocks;
    }

    private static List<NamedBlock> buildElementBlocks(DungeonRoom room, List<DungeonFeature> features) {
        List<NamedBlock> blocks = new ArrayList<>();
        addNamedBlock(blocks, null, room.detailDescription());
        for (DungeonFeature feature : features) {
            addNamedBlock(blocks, feature.toString(), feature.detailDescription());
        }
        return blocks;
    }

    private static List<NamedBlock> buildGmBlocks(DungeonRoom room, List<DungeonFeature> features) {
        List<NamedBlock> blocks = new ArrayList<>();
        addNamedBlock(blocks, null, room.gmBackground());
        for (DungeonFeature feature : features) {
            addNamedBlock(blocks, feature.toString(), feature.gmBackground());
        }
        return blocks;
    }

    private static void appendParagraphSection(VBox parent, String title, List<String> paragraphs) {
        if (paragraphs.isEmpty()) {
            return;
        }
        VBox content = new VBox(8);
        for (String paragraph : paragraphs) {
            Label label = new Label(paragraph);
            label.setWrapText(true);
            content.getChildren().add(label);
        }
        parent.getChildren().add(section(title, content));
    }

    private static void appendNamedSection(VBox parent, String title, List<NamedBlock> blocks) {
        if (blocks.isEmpty()) {
            return;
        }
        VBox content = new VBox(10);
        for (NamedBlock block : blocks) {
            VBox row = new VBox(4);
            if (block.title() != null && !block.title().isBlank()) {
                Label label = new Label(block.title());
                label.getStyleClass().add("section-header");
                row.getChildren().add(label);
            }
            Label body = new Label(block.body());
            body.setWrapText(true);
            row.getChildren().add(body);
            content.getChildren().add(row);
        }
        parent.getChildren().add(section(title, content));
    }

    private static Node section(String title, Node content) {
        VBox box = new VBox(6);
        Label label = new Label(title);
        label.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(label, content);
        return box;
    }

    private static Label title(String value) {
        Label label = new Label(value);
        label.getStyleClass().add("dungeon-panel-title");
        label.setWrapText(true);
        VBox.setVgrow(label, Priority.NEVER);
        return label;
    }

    private static void addIfPresent(List<String> target, String value) {
        if (value != null && !value.isBlank()) {
            target.add(value);
        }
    }

    private static void addNamedBlock(List<NamedBlock> target, String title, String body) {
        if (body == null || body.isBlank()) {
            return;
        }
        target.add(new NamedBlock(title, body));
    }

    private static String formatRoomTitle(DungeonRoom room) {
        String title = room.name() == null || room.name().isBlank() ? "Raum" : room.name().trim();
        return room.roomId() == null ? title : room.roomId() + ": " + title;
    }

    private record NamedBlock(String title, String body) {
    }
}
