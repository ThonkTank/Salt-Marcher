package features.world.dungeonmap.ui.editor.toolbar;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.VBox;
import ui.components.AnchoredDropdown;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class DungeonToolModeDropdown<T> {

    public record Option<T>(T value, String label) {}

    private final VBox panel = new VBox(10);
    private final Label titleLabel = new Label();
    private final FlowPane optionRow = new FlowPane();
    private final AnchoredDropdown dropdown;

    private List<Option<T>> options = List.of();

    public DungeonToolModeDropdown(String title) {
        panel.getStyleClass().add("dropdown-window");
        panel.setPadding(new Insets(12));

        titleLabel.getStyleClass().add("dropdown-title");
        titleLabel.setText(title == null ? "" : title);

        optionRow.setHgap(6);
        optionRow.setVgap(6);
        optionRow.getStyleClass().add("editor-tool-flow");

        panel.getChildren().addAll(titleLabel, optionRow);
        dropdown = new AnchoredDropdown(panel);
    }

    public void setOptions(List<Option<T>> options) {
        this.options = options == null ? List.of() : List.copyOf(options);
    }

    public void show(Node anchor, T selectedValue, Consumer<T> onSelected) {
        optionRow.getChildren().clear();
        ToggleGroup group = new ToggleGroup();
        for (Option<T> option : options) {
            ToggleButton button = new ToggleButton(option.label());
            button.getStyleClass().add("tool-btn");
            button.setToggleGroup(group);
            button.setSelected(Objects.equals(option.value(), selectedValue));
            button.setOnAction(event -> {
                if (onSelected != null) {
                    onSelected.accept(option.value());
                }
                dropdown.hide();
            });
            optionRow.getChildren().add(button);
        }
        dropdown.show(anchor);
    }

    public void hide() {
        dropdown.hide();
    }
}
