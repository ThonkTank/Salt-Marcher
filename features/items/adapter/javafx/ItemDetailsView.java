package features.items.adapter.javafx;

import features.items.api.ItemsCatalogApi;
import java.util.Objects;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;

/** Provider-owned rendering for read-only Item details. */
public final class ItemDetailsView {

    private ItemDetailsView() {
    }

    public static void openInspector(InspectorSink inspector, ItemsCatalogApi.ItemDetail detail) {
        InspectorSink sink = Objects.requireNonNull(inspector, "inspector");
        ItemsCatalogApi.ItemDetail item = Objects.requireNonNull(detail, "detail");
        sink.push(new InspectorEntrySpec(
                item.name(), "item:" + item.sourceKey(), () -> content(item), null));
    }

    private static Node content(ItemsCatalogApi.ItemDetail detail) {
        VBox content = new VBox(
                fact("Kategorie", joined(detail.category(), detail.subcategory())),
                fact("Magisch", yesNo(detail.magic())),
                fact("Seltenheit", shown(detail.rarity())),
                fact("Attunement", yesNo(detail.attunement())),
                fact("Kosten", costText(detail)),
                fact("Gewicht", detail.weight() == null ? "–" : detail.weight().toString()),
                fact("Eigenschaften", detail.properties().isEmpty() ? "–" : String.join(", ", detail.properties())),
                fact("Schaden", shown(detail.damage())),
                fact("Rüstungsklasse", shown(detail.armorClass())),
                fact("Beschreibung", shown(detail.description())),
                fact("Quelle", joined(detail.sourceVersion(), detail.sourceUrl())));
        content.getStyleClass().add("catalog-item-details");
        return content;
    }

    private static Label fact(String label, String value) {
        Label fact = new Label(label + ": " + value);
        fact.setWrapText(true);
        return fact;
    }

    private static String costText(ItemsCatalogApi.ItemDetail detail) {
        String display = shown(detail.costDisplay());
        return detail.costCp() == null ? display : display + " (" + detail.costCp() + " CP)";
    }

    private static String joined(String first, String second) {
        if (first == null || first.isBlank()) {
            return shown(second);
        }
        return second == null || second.isBlank() ? first : first + " / " + second;
    }

    private static String shown(String value) {
        return value == null || value.isBlank() ? "–" : value;
    }

    private static String yesNo(boolean value) {
        return value ? "Ja" : "Nein";
    }
}
