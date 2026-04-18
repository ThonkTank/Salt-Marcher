package src.view.encounter.View;

import javafx.collections.ListChangeListener;
import javafx.scene.control.Button;
import javafx.scene.control.CheckMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import src.view.encounter.Model.EncounterFilterOptionsViewData;
import src.view.encounter.Model.EncounterFilterSelectionModel;
import src.view.encounter.Model.EncounterModel;

import java.util.List;
import java.util.Objects;

public final class EncounterFilterPane extends VBox {

    private final EncounterFilterSelectionModel selection;
    private final MenuButton typeFilter = createFilterButton();
    private final MenuButton subtypeFilter = createFilterButton();
    private final MenuButton biomeFilter = createFilterButton();
    private final FlowPane chipsPane = new FlowPane(4, 2);

    public EncounterFilterPane(EncounterModel model) {
        Objects.requireNonNull(model, "model");
        this.selection = Objects.requireNonNull(model.filterSelection(), "selection");

        getStyleClass().add("filter-pane");
        setSpacing(4);
        setPadding(new javafx.geometry.Insets(6, 8, 6, 8));

        FlowPane filterRow = new FlowPane(4, 4, typeFilter, subtypeFilter, biomeFilter, clearButton());
        chipsPane.setMinHeight(24);
        filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        getChildren().addAll(filterRow, chipsPane);

        installSelectionListener(selection.selectedTypes(), "Typ", typeFilter);
        installSelectionListener(selection.selectedSubtypes(), "Unterart", subtypeFilter);
        installSelectionListener(selection.selectedBiomes(), "Umgebung", biomeFilter);
        rebuildMenus(model.filterOptions());
        model.filterOptionsProperty().addListener((ignored, before, after) -> rebuildMenus(after));
        rebuildChips();
    }

    private void rebuildMenus(EncounterFilterOptionsViewData options) {
        EncounterFilterOptionsViewData safeOptions = options == null
                ? EncounterFilterOptionsViewData.empty()
                : options;
        rebuildMenu(typeFilter, "Typ", safeOptions.types(), selection.selectedTypes());
        rebuildMenu(subtypeFilter, "Unterart", safeOptions.subtypes(), selection.selectedSubtypes());
        rebuildMenu(biomeFilter, "Umgebung", safeOptions.biomes(), selection.selectedBiomes());
    }

    private void rebuildMenu(
            MenuButton button,
            String label,
            List<String> options,
            List<String> selectedValues
    ) {
        button.getItems().clear();
        for (String option : options) {
            CheckMenuItem item = new CheckMenuItem(option);
            item.setSelected(selectedValues.contains(option));
            item.selectedProperty().addListener((ignored, before, after) -> {
                if (after) {
                    if (!selectedValues.contains(option)) {
                        selectedValues.add(option);
                    }
                } else {
                    selectedValues.remove(option);
                }
            });
            button.getItems().add(item);
        }
        updateButtonLabel(button, label, selectedValues.size());
    }

    private void installSelectionListener(
            javafx.collections.ObservableList<String> values,
            String label,
            MenuButton button
    ) {
        values.addListener((ListChangeListener<String>) ignored -> {
            updateButtonLabel(button, label, values.size());
            rebuildChips();
        });
        updateButtonLabel(button, label, values.size());
    }

    private void rebuildChips() {
        chipsPane.getChildren().clear();
        addChips("chip-type", selection.selectedTypes());
        addChips("chip-subtype", selection.selectedSubtypes());
        addChips("chip-biome", selection.selectedBiomes());
    }

    private void addChips(String styleClass, List<String> values) {
        for (String value : values) {
            chipsPane.getChildren().add(makeChip(value, styleClass, () -> removeValue(value)));
        }
    }

    private void removeValue(String value) {
        selection.selectedTypes().remove(value);
        selection.selectedSubtypes().remove(value);
        selection.selectedBiomes().remove(value);
    }

    private Button clearButton() {
        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(event -> selection.clear());
        return clearButton;
    }

    private static MenuButton createFilterButton() {
        MenuButton button = new MenuButton();
        button.getStyleClass().addAll("compact", "filter-trigger");
        return button;
    }

    private static void updateButtonLabel(MenuButton button, String label, int selectedCount) {
        button.getStyleClass().remove("filter-trigger-active");
        if (selectedCount > 0) {
            button.setText(label + " (" + selectedCount + ") \u25BE");
            button.getStyleClass().add("filter-trigger-active");
            return;
        }
        button.setText(label + " \u25BE");
    }

    private static HBox makeChip(String text, String styleClass, Runnable onRemove) {
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
