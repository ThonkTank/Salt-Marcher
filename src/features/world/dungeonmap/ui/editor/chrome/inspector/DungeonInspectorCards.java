package features.world.dungeonmap.ui.editor.chrome.inspector;

import features.world.dungeonmap.api.catalog.DungeonEncounterSummary;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.List;
import java.util.function.Function;

final class DungeonInspectorCards {

    private DungeonInspectorCards() {
    }

    static VBox card() {
        VBox box = new VBox(10);
        box.setPadding(new javafx.geometry.Insets(12));
        return box;
    }

    static VBox editorCard() {
        VBox box = new VBox(8);
        box.getStyleClass().add("dungeon-editor-card");
        box.setPadding(new javafx.geometry.Insets(10));
        return box;
    }

    static VBox section(String title, Node... content) {
        VBox box = new VBox(6);
        Label label = new Label(title);
        label.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().add(label);
        box.getChildren().addAll(content);
        return box;
    }

    static Label secondary(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        return label;
    }

    static TextArea textArea(String value) {
        TextArea area = new TextArea(value == null ? "" : value);
        area.setWrapText(true);
        area.setPrefRowCount(4);
        return area;
    }

    static TextArea compactTextArea(String value) {
        TextArea area = textArea(value);
        area.setPrefRowCount(3);
        return area;
    }

    static Button saveButton(Runnable onSave) {
        Button button = new Button("Speichern");
        button.setOnAction(event -> onSave.run());
        return button;
    }

    static Button dangerButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("danger");
        return button;
    }

    static HBox saveRow(Node... nodes) {
        HBox row = new HBox(8, nodes);
        row.setFillHeight(true);
        return row;
    }

    static <T> StringConverter<T> namedConverter(Function<T, String> labelProvider) {
        return new StringConverter<>() {
            @Override
            public String toString(T object) {
                return object == null ? "" : valueOrDash(labelProvider.apply(object));
            }

            @Override
            public T fromString(String string) {
                return null;
            }
        };
    }

    static void updateEncounterComboState(ComboBox<DungeonEncounterSummary> comboBox, features.world.dungeonmap.model.domain.DungeonFeatureCategory category) {
        boolean enabled = category == features.world.dungeonmap.model.domain.DungeonFeatureCategory.ENCOUNTER;
        comboBox.setDisable(!enabled);
        comboBox.setManaged(true);
        if (!enabled) {
            comboBox.setValue(null);
        }
    }

    static <T> T findById(List<T> values, Long id, Function<T, Long> idAccessor) {
        if (values == null || id == null) {
            return null;
        }
        for (T value : values) {
            if (id.equals(idAccessor.apply(value))) {
                return value;
            }
        }
        return null;
    }

    static void appendListSection(VBox parent, String title, List<String> items) {
        if (items.isEmpty()) {
            return;
        }
        VBox content = new VBox(4);
        for (String item : items) {
            Label label = new Label(item);
            label.setWrapText(true);
            content.getChildren().add(label);
        }
        VBox section = section(title, content);
        VBox.setVgrow(content, Priority.NEVER);
        parent.getChildren().add(section);
    }

    static String formatPosition(int x, int y) {
        return "(" + x + ", " + y + ")";
    }

    static String titleOrFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
