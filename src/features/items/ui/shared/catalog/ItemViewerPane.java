package features.items.ui.shared.catalog;

import features.items.api.ItemCatalogService;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public class ItemViewerPane extends VBox {
    public ItemViewerPane(ItemCatalogService.ItemDetails item) {
        setPadding(new Insets(12));
        setSpacing(10);

        if (item == null) {
            Label empty = new Label("Item nicht gefunden");
            empty.getStyleClass().add("text-muted");
            getChildren().add(empty);
            return;
        }

        Label name = new Label(item.name() != null ? item.name() : "");
        name.getStyleClass().add("large");
        name.setWrapText(true);

        Label type = infoLabel(typeText(item));
        Label magic = infoLabel(magicText(item));
        Label stats = infoLabel(statsText(item));
        Label tags = infoLabel(tagsText(item));
        Label source = infoLabel(item.source() == null || item.source().isBlank() ? "" : "Quelle: " + item.source());

        VBox descriptionSection = new VBox(4);
        Label descriptionHeader = new Label("Beschreibung");
        descriptionHeader.getStyleClass().addAll("section-header", "text-muted");
        Label description = new Label(
                item.description() == null || item.description().isBlank() ? "Keine Beschreibung" : item.description());
        description.setWrapText(true);
        descriptionSection.getChildren().addAll(descriptionHeader, description);

        getChildren().add(name);
        if (!type.getText().isBlank()) getChildren().add(type);
        if (!magic.getText().isBlank()) getChildren().add(magic);
        if (!stats.getText().isBlank()) getChildren().add(stats);
        if (!tags.getText().isBlank()) getChildren().add(tags);
        if (!source.getText().isBlank()) getChildren().add(source);
        getChildren().add(descriptionSection);
    }

    private static Label infoLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-secondary");
        label.setWrapText(true);
        return label;
    }

    private static String typeText(ItemCatalogService.ItemDetails item) {
        StringBuilder text = new StringBuilder();
        if (item.category() != null && !item.category().isBlank()) text.append(item.category());
        if (item.subcategory() != null && !item.subcategory().isBlank()) {
            if (!text.isEmpty()) text.append(" \u00b7 ");
            text.append(item.subcategory());
        }
        if (item.rarity() != null && !item.rarity().isBlank()) {
            if (!text.isEmpty()) text.append(" \u00b7 ");
            text.append(item.rarity());
        }
        return text.toString();
    }

    private static String magicText(ItemCatalogService.ItemDetails item) {
        if (!item.magic() && !item.requiresAttunement()) return "";
        if (item.requiresAttunement()) {
            if (item.attunementCondition() != null && !item.attunementCondition().isBlank()) {
                return "Magisch, Einstimmung: " + item.attunementCondition();
            }
            return "Magisch, benötigt Einstimmung";
        }
        return "Magisch";
    }

    private static String statsText(ItemCatalogService.ItemDetails item) {
        StringBuilder text = new StringBuilder();
        if (item.costDisplay() != null && !item.costDisplay().isBlank()) text.append("Wert: ").append(item.costDisplay());
        else if (item.costCp() > 0) text.append("Wert: ").append(item.costCp()).append(" cp");
        if (item.weightLb() > 0) {
            if (!text.isEmpty()) text.append("  |  ");
            text.append("Gewicht: ").append(trimDouble(item.weightLb())).append(" lb");
        }
        if (item.damage() != null && !item.damage().isBlank()) {
            if (!text.isEmpty()) text.append("  |  ");
            text.append("Schaden: ").append(item.damage());
        }
        if (item.armorClass() != null && !item.armorClass().isBlank()) {
            if (!text.isEmpty()) text.append("  |  ");
            text.append("RK: ").append(item.armorClass());
        }
        if (item.properties() != null && !item.properties().isBlank()) {
            if (!text.isEmpty()) text.append("  |  ");
            text.append("Eigenschaften: ").append(item.properties());
        }
        return text.toString();
    }

    private static String tagsText(ItemCatalogService.ItemDetails item) {
        if (item.tags() == null || item.tags().isEmpty()) return "";
        return "Tags: " + String.join(", ", item.tags());
    }

    private static String trimDouble(double value) {
        if (value == (long) value) return Long.toString((long) value);
        return Double.toString(value);
    }
}
