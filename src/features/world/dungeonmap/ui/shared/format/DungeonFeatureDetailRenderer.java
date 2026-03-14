package features.world.dungeonmap.ui.shared.format;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class DungeonFeatureDetailRenderer {

    private DungeonFeatureDetailRenderer() {
    }

    public static void appendStructuredDetails(
            VBox parent,
            DungeonFeature feature,
            String encounterName
    ) {
        if (parent == null || feature == null) {
            return;
        }

        parent.getChildren().add(title(title(feature)));
        parent.getChildren().add(metadata(feature, encounterName));
        appendParagraphSection(parent, "Auf den ersten Blick", feature.glanceDescription());
        appendParagraphSection(parent, "Reaktive Checks", feature.reactiveChecks());
        appendParagraphSection(parent, "Signifikante Elemente", feature.detailDescription());
        appendParagraphSection(parent, "GM-Hintergrund", feature.gmBackground());
    }

    private static void appendParagraphSection(VBox parent, String title, String body) {
        if (body == null || body.isBlank()) {
            return;
        }
        Label label = new Label(body);
        label.setWrapText(true);
        parent.getChildren().add(section(title, label));
    }

    private static Node metadata(DungeonFeature feature, String encounterName) {
        VBox box = new VBox(4);
        DungeonFeatureCategory category = feature.category() == null ? DungeonFeatureCategory.CURIOSITY : feature.category();
        box.getChildren().add(secondary("Kategorie: " + category.label()));
        if (feature.category() == DungeonFeatureCategory.ENCOUNTER || feature.encounterId() != null) {
            box.getChildren().add(secondary("Encounter: " + valueOrDash(encounterName)));
        }
        box.getChildren().add(secondary("Reihenfolge: " + feature.sortOrder()));
        return box;
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

    private static Label secondary(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        return label;
    }

    private static String title(DungeonFeature feature) {
        if (feature.name() != null && !feature.name().isBlank()) {
            return feature.name().trim();
        }
        DungeonFeatureCategory category = feature.category() == null ? DungeonFeatureCategory.CURIOSITY : feature.category();
        return category.label();
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
