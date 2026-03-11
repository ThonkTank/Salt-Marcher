package features.spells.ui.shared.catalog;

import features.spells.api.SpellCatalogService;
import javafx.animation.PauseTransition;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import ui.components.SearchableFilterButton;

import java.util.List;
import java.util.function.Consumer;

public class SpellFilterPane extends VBox {
    private Consumer<SpellCatalogService.FilterCriteria> onFilterChanged;

    private final TextField searchField;
    private final CheckBox ritualOnlyCheck;
    private final CheckBox concentrationOnlyCheck;
    private final SearchableFilterButton levelFilter;
    private final SearchableFilterButton schoolFilter;
    private final SearchableFilterButton classFilter;
    private final SearchableFilterButton tagFilter;
    private final SearchableFilterButton sourceFilter;
    private final FlowPane chipsPane;

    public SpellFilterPane(SpellCatalogService.FilterOptions data) {
        getStyleClass().add("filter-pane");
        setSpacing(4);
        setPadding(new Insets(6, 8, 6, 8));

        searchField = new TextField();
        searchField.setPromptText("Zauber suchen...");
        searchField.setMaxWidth(Double.MAX_VALUE);

        PauseTransition debounce = new PauseTransition(Duration.millis(300));
        debounce.setOnFinished(e -> fireChange());
        searchField.textProperty().addListener((obs, oldValue, newValue) -> debounce.playFromStart());

        ritualOnlyCheck = new CheckBox("Nur Ritual");
        concentrationOnlyCheck = new CheckBox("Nur Konzentration");
        ritualOnlyCheck.setOnAction(e -> fireChange());
        concentrationOnlyCheck.setOnAction(e -> fireChange());

        levelFilter = new SearchableFilterButton("Grad", data.levels(), vals -> fireChange());
        schoolFilter = new SearchableFilterButton("Schule", data.schools(), vals -> fireChange());
        classFilter = new SearchableFilterButton("Klasse", data.classes(), vals -> fireChange());
        tagFilter = new SearchableFilterButton("Tags", data.tags(), vals -> fireChange());
        sourceFilter = new SearchableFilterButton("Quelle", data.sources(), vals -> fireChange());

        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(e -> clearAll());

        HBox searchRow = new HBox(6, searchField);
        HBox.setHgrow(searchField, Priority.ALWAYS);

        HBox toggleRow = new HBox(6, ritualOnlyCheck, concentrationOnlyCheck);

        FlowPane filterRow = new FlowPane(4, 4);
        filterRow.getChildren().addAll(levelFilter, schoolFilter, classFilter, tagFilter, sourceFilter, clearButton);

        chipsPane = new FlowPane(4, 2);
        chipsPane.setMinHeight(24);

        filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.prefWrapLengthProperty().bind(widthProperty().subtract(16));

        getChildren().addAll(searchRow, toggleRow, filterRow, chipsPane);
    }

    public void setOnFilterChanged(Consumer<SpellCatalogService.FilterCriteria> callback) {
        onFilterChanged = callback;
    }

    public SpellCatalogService.FilterCriteria buildCriteria() {
        return new SpellCatalogService.FilterCriteria(
                normalize(searchField.getText()),
                ritualOnlyCheck.isSelected(),
                concentrationOnlyCheck.isSelected(),
                levelFilter.getSelectedValues(),
                schoolFilter.getSelectedValues(),
                classFilter.getSelectedValues(),
                tagFilter.getSelectedValues(),
                sourceFilter.getSelectedValues());
    }

    private void fireChange() {
        SpellCatalogService.FilterCriteria criteria = buildCriteria();
        rebuildChips(criteria);
        if (onFilterChanged != null) onFilterChanged.accept(criteria);
    }

    private void clearAll() {
        searchField.setText("");
        ritualOnlyCheck.setSelected(false);
        concentrationOnlyCheck.setSelected(false);
        levelFilter.clearSelection();
        schoolFilter.clearSelection();
        classFilter.clearSelection();
        tagFilter.clearSelection();
        sourceFilter.clearSelection();
        fireChange();
    }

    private void rebuildChips(SpellCatalogService.FilterCriteria criteria) {
        chipsPane.getChildren().clear();
        if (criteria.nameQuery() != null) {
            chipsPane.getChildren().add(makeChip("Suche: " + criteria.nameQuery(), "chip-item-search", () -> {
                searchField.setText("");
                fireChange();
            }));
        }
        if (criteria.ritualOnly()) {
            chipsPane.getChildren().add(makeChip("Ritual", "chip-item-magic", () -> {
                ritualOnlyCheck.setSelected(false);
                fireChange();
            }));
        }
        if (criteria.concentrationOnly()) {
            chipsPane.getChildren().add(makeChip("Konzentration", "chip-item-attunement", () -> {
                concentrationOnlyCheck.setSelected(false);
                fireChange();
            }));
        }
        addFilterChips(criteria.levels(), "chip-cr", levelFilter);
        addFilterChips(criteria.schools(), "chip-type", schoolFilter);
        addFilterChips(criteria.classes(), "chip-size", classFilter);
        addFilterChips(criteria.tags(), "chip-item-tag", tagFilter);
        addFilterChips(criteria.sources(), "chip-item-source", sourceFilter);
    }

    private void addFilterChips(List<String> values, String cssClass, SearchableFilterButton filter) {
        for (String value : values) {
            chipsPane.getChildren().add(makeChip(value, cssClass, () -> {
                filter.removeValue(value);
                fireChange();
            }));
        }
    }

    private HBox makeChip(String text, String styleClass, Runnable onRemove) {
        HBox chip = new HBox(2);
        chip.getStyleClass().addAll("chip", styleClass);
        Label label = new Label(text);
        Button remove = new Button("\u00d7");
        remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
        remove.setAccessibleText("Entfernen: " + text);
        remove.setOnAction(e -> onRemove.run());
        chip.getChildren().addAll(label, remove);
        return chip;
    }

    private static String normalize(String value) {
        if (value == null) return null;
        String stripped = value.trim();
        return stripped.isEmpty() ? null : stripped;
    }
}
