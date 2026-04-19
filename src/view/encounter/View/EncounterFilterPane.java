package src.view.encounter.View;

import javafx.scene.control.Button;
import javafx.scene.control.CheckMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import src.view.encounter.ViewModel.EncounterSnapshot;
import src.view.encounter.ViewModel.EncounterViewModel;

import java.util.List;
import java.util.Objects;

public final class EncounterFilterPane extends VBox {

    private final EncounterViewModel viewModel;
    private final MenuButton typeFilter = createFilterButton();
    private final MenuButton subtypeFilter = createFilterButton();
    private final MenuButton biomeFilter = createFilterButton();
    private final FlowPane chipsPane = new FlowPane(4, 2);

    public EncounterFilterPane(EncounterViewModel viewModel) {
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
        getStyleClass().add("surface-root");
        setSpacing(4);
        setPadding(new javafx.geometry.Insets(6, 8, 6, 8));

        FlowPane filterRow = new FlowPane(4, 4, typeFilter, subtypeFilter, biomeFilter, clearButton());
        chipsPane.setMinHeight(24);
        filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        getChildren().addAll(filterRow, chipsPane);
        this.viewModel.addChangeListener(this::refreshFromViewModel);
        refreshFromViewModel();
    }

    private void refreshFromViewModel() {
        EncounterSnapshot snapshot = viewModel.snapshot();
        rebuildMenus(snapshot.filterOptions(), snapshot.filterSelection());
        rebuildChips(snapshot.filterSelection());
    }

    private void rebuildMenus(
            EncounterSnapshot.FilterOptionsViewData options,
            EncounterSnapshot.FilterSelectionViewData selection
    ) {
        rebuildMenu(typeFilter, "Typ", options.types(), selection.selectedTypes(), viewModel::setTypeSelected);
        rebuildMenu(subtypeFilter, "Unterart", options.subtypes(), selection.selectedSubtypes(), viewModel::setSubtypeSelected);
        rebuildMenu(biomeFilter, "Umgebung", options.biomes(), selection.selectedBiomes(), viewModel::setBiomeSelected);
    }

    private void rebuildMenu(
            MenuButton button,
            String label,
            List<String> options,
            List<String> selectedValues,
            java.util.function.BiConsumer<String, Boolean> onSelectedChanged
    ) {
        button.getItems().clear();
        for (String option : options) {
            CheckMenuItem item = new CheckMenuItem(option);
            item.setSelected(selectedValues.contains(option));
            item.selectedProperty().addListener((ignored, before, after) -> onSelectedChanged.accept(option, after));
            button.getItems().add(item);
        }
        updateButtonLabel(button, label, selectedValues.size());
    }

    private void rebuildChips(EncounterSnapshot.FilterSelectionViewData selection) {
        chipsPane.getChildren().clear();
        addChips("chip-type", selection.selectedTypes());
        addChips("chip-subtype", selection.selectedSubtypes());
        addChips("chip-biome", selection.selectedBiomes());
    }

    private void addChips(String styleClass, List<String> values) {
        for (String value : values) {
            chipsPane.getChildren().add(makeChip(value, styleClass, () -> viewModel.removeFilterValue(value)));
        }
    }

    private Button clearButton() {
        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(event -> viewModel.clearFilters());
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
        chip.getChildren().addAll(new Label(text), createChipRemoveButton(text, onRemove));
        return chip;
    }

    private static Button createChipRemoveButton(String text, Runnable onRemove) {
        Button remove = new Button("\u00D7");
        remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
        remove.setAccessibleText("Entfernen: " + text);
        remove.setOnAction(event -> onRemove.run());
        return remove;
    }
}
