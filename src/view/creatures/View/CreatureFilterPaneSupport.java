package src.view.creatures.View;

import javafx.collections.ObservableList;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import org.jspecify.annotations.Nullable;

import java.util.List;

final class CreatureFilterPaneSupport {

    private CreatureFilterPaneSupport() {
    }

    static void addIfPresent(FlowPane row, @Nullable SearchableFilterButton button) {
        if (button != null) {
            row.getChildren().add(button);
        }
    }

    static void syncSelection(ObservableList<String> target, @Nullable SearchableFilterButton button) {
        if (button == null) {
            target.clear();
            return;
        }
        target.setAll(button.selectedValues());
    }

    static void clearSelection(@Nullable SearchableFilterButton button) {
        if (button != null) {
            button.clearSelection();
        }
    }

    static void addFilterChips(
            FlowPane chipsPane,
            List<String> values,
            String styleClass,
            @Nullable SearchableFilterButton button,
            Runnable onChanged
    ) {
        if (button == null) {
            return;
        }
        for (String value : values) {
            chipsPane.getChildren().add(makeChip(value, styleClass, () -> {
                button.removeValue(value);
                onChanged.run();
            }));
        }
    }

    static HBox makeChip(String text, String styleClass, Runnable onRemove) {
        HBox chip = new HBox(2);
        chip.getStyleClass().addAll("chip", styleClass);
        Label label = new Label(text);
        Button remove = new Button("\u00D7");
        remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
        remove.setAccessibleText("Entfernen: " + text);
        remove.setOnAction(event -> onRemove.run());
        chip.getChildren().addAll(label, remove);
        return chip;
    }
}
