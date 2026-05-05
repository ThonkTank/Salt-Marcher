package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.function.Consumer;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;

final class CatalogFilterChipsStrip extends FlowPane {

    private static final String REMOVE_SYMBOL = "×";
    private static final String STYLE_CHIP = "chip";
    private static final String STYLE_FLAT = "flat";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_REMOVE_BUTTON = "chip-remove-btn";
    private static final String REMOVE_TEXT_PREFIX = "Entfernen: ";

    private final Consumer<String> removeChipAction;

    CatalogFilterChipsStrip(Consumer<String> removeChipAction) {
        super(4, 2);
        this.removeChipAction = removeChipAction;
        prefWrapLengthProperty().bind(widthProperty().subtract(16));
        setMinHeight(24);
    }

    void setChips(List<FilterChipView> chips) {
        getChildren().clear();
        for (FilterChipView chip : safeChips(chips)) {
            getChildren().add(chipNode(chip));
        }
    }

    private List<FilterChipView> safeChips(List<FilterChipView> chips) {
        return chips == null ? List.of() : List.copyOf(chips);
    }

    private HBox chipNode(FilterChipView chip) {
        HBox chipNode = new HBox(2);
        chipNode.getStyleClass().addAll(STYLE_CHIP, chip.styleClass());

        Label label = new Label(chip.label());
        Button remove = new Button(REMOVE_SYMBOL);
        remove.getStyleClass().addAll(STYLE_FLAT, STYLE_COMPACT, STYLE_REMOVE_BUTTON);
        remove.setAccessibleText(REMOVE_TEXT_PREFIX + chip.label());
        remove.setOnAction(event -> removeChipAction.accept(chip.key()));

        chipNode.getChildren().addAll(label, remove);
        return chipNode;
    }

    record FilterChipView(String key, String label, String styleClass) {
    }
}
