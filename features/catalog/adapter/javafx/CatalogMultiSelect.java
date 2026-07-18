package features.catalog.adapter.javafx;

import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import javafx.geometry.Side;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;

/** Shared labeled multi-select filter with one Catalog control treatment. */
final class CatalogMultiSelect<T> {

    private final String label;
    private final Function<T, String> labeler;
    private final Button button;
    private final ContextMenu menu = new ContextMenu();
    private final VBox options = new VBox();
    private final Runnable changed;

    CatalogMultiSelect(String label, Function<T, String> labeler, Runnable changed) {
        this.label = Objects.requireNonNull(label, "label");
        this.labeler = Objects.requireNonNull(labeler, "labeler");
        this.changed = Objects.requireNonNull(changed, "changed");
        options.getStyleClass().add("catalog-filter-dropdown-options");
        button = CatalogControlKit.filterButton(label + " ▾", label + " auswählen");
        ScrollPane scroll = new ScrollPane(options);
        scroll.setFitToWidth(true);
        VBox dropdown = new VBox(scroll);
        dropdown.getStyleClass().add("filter-dropdown");
        menu.getItems().setAll(new CustomMenuItem(dropdown, false));
        button.setOnAction(ignored -> {
            if (menu.isShowing()) {
                menu.hide();
            } else {
                menu.show(button, Side.BOTTOM, 0.0, 2.0);
            }
        });
    }

    Button button() {
        return button;
    }

    void render(List<T> values, List<T> selected) {
        render(values, selected, Function.identity());
    }

    <K> void render(List<T> values, List<K> selected, Function<T, K> key) {
        options.getChildren().clear();
        for (T value : values) {
            CheckBox checkBox = new CheckBox(labeler.apply(value));
            checkBox.setUserData(value);
            checkBox.setSelected(selected.contains(key.apply(value)));
            checkBox.setOnAction(ignored -> {
                updateButton();
                changed.run();
            });
            options.getChildren().add(checkBox);
        }
        updateButton();
    }

    @SuppressWarnings("unchecked")
    List<T> selectedValues() {
        return options.getChildren().stream().map(CheckBox.class::cast)
                .filter(CheckBox::isSelected).map(checkBox -> (T) checkBox.getUserData()).toList();
    }

    <K> List<K> selectedKeys(Function<T, K> key) {
        return selectedValues().stream().map(key).toList();
    }

    void deselectValue(T value) {
        deselectKey(value, Function.identity());
    }

    @SuppressWarnings("unchecked")
    <K> void deselectKey(K value, Function<T, K> key) {
        options.getChildren().stream().map(CheckBox.class::cast)
                .filter(checkBox -> Objects.equals(value, key.apply((T) checkBox.getUserData())))
                .findFirst().ifPresent(checkBox -> checkBox.setSelected(false));
        updateButton();
    }

    private void updateButton() {
        long selected = options.getChildren().stream().map(CheckBox.class::cast)
                .filter(CheckBox::isSelected).count();
        button.setText(selected == 0L ? label + " ▾" : label + " (" + selected + ") ▾");
    }
}
