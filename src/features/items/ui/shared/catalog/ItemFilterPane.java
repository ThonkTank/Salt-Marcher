package features.items.ui.shared.catalog;

import features.items.api.ItemCatalogService;
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

public class ItemFilterPane extends VBox {
    private Consumer<ItemCatalogService.FilterCriteria> onFilterChanged;

    private final TextField searchField;
    private final TextField minCostField;
    private final TextField maxCostField;
    private final CheckBox magicOnlyCheck;
    private final CheckBox attunementOnlyCheck;
    private final SearchableFilterButton categoryFilter;
    private final SearchableFilterButton subcategoryFilter;
    private final SearchableFilterButton rarityFilter;
    private final SearchableFilterButton tagFilter;
    private final SearchableFilterButton sourceFilter;
    private final FlowPane chipsPane;

    public ItemFilterPane(ItemCatalogService.FilterOptions data) {
        getStyleClass().add("filter-pane");
        setSpacing(4);
        setPadding(new Insets(6, 8, 6, 8));

        searchField = new TextField();
        searchField.setPromptText("Item suchen...");
        searchField.setMaxWidth(Double.MAX_VALUE);

        PauseTransition debounce = new PauseTransition(Duration.millis(300));
        debounce.setOnFinished(e -> fireChange());
        searchField.textProperty().addListener((obs, oldValue, newValue) -> debounce.playFromStart());

        minCostField = costField("Min cp", debounce);
        maxCostField = costField("Max cp", debounce);

        magicOnlyCheck = new CheckBox("Nur magisch");
        attunementOnlyCheck = new CheckBox("Nur Einstimmung");
        magicOnlyCheck.setOnAction(e -> fireChange());
        attunementOnlyCheck.setOnAction(e -> fireChange());

        categoryFilter = new SearchableFilterButton("Kategorie", data.categories(), vals -> fireChange());
        subcategoryFilter = new SearchableFilterButton("Unterkategorie", data.subcategories(), vals -> fireChange());
        rarityFilter = new SearchableFilterButton("Seltenheit", data.rarities(), vals -> fireChange());
        tagFilter = new SearchableFilterButton("Tags", data.tags(), vals -> fireChange());
        sourceFilter = new SearchableFilterButton("Quelle", data.sources(), vals -> fireChange());

        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(e -> clearAll());

        HBox searchRow = new HBox(6, searchField);
        HBox.setHgrow(searchField, Priority.ALWAYS);

        HBox costRow = new HBox(6, new Label("Wert:"), minCostField, maxCostField, magicOnlyCheck, attunementOnlyCheck);
        costRow.setFillHeight(true);

        FlowPane filterRow = new FlowPane(4, 4);
        filterRow.getChildren().addAll(categoryFilter, subcategoryFilter, rarityFilter, tagFilter, sourceFilter, clearButton);

        chipsPane = new FlowPane(4, 2);
        chipsPane.setMinHeight(24);

        filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.prefWrapLengthProperty().bind(widthProperty().subtract(16));

        getChildren().addAll(searchRow, costRow, filterRow, chipsPane);
    }

    public void setOnFilterChanged(Consumer<ItemCatalogService.FilterCriteria> callback) {
        onFilterChanged = callback;
    }

    public ItemCatalogService.FilterCriteria buildCriteria() {
        String name = normalize(searchField.getText());
        return new ItemCatalogService.FilterCriteria(
                name,
                parseIntOrNull(minCostField.getText()),
                parseIntOrNull(maxCostField.getText()),
                magicOnlyCheck.isSelected(),
                attunementOnlyCheck.isSelected(),
                categoryFilter.getSelectedValues(),
                subcategoryFilter.getSelectedValues(),
                rarityFilter.getSelectedValues(),
                tagFilter.getSelectedValues(),
                sourceFilter.getSelectedValues());
    }

    private TextField costField(String prompt, PauseTransition debounce) {
        TextField field = new TextField();
        field.setPromptText(prompt);
        field.setPrefWidth(80);
        field.textProperty().addListener((obs, oldValue, newValue) -> debounce.playFromStart());
        return field;
    }

    private void fireChange() {
        ItemCatalogService.FilterCriteria criteria = buildCriteria();
        rebuildChips(criteria);
        if (onFilterChanged != null) onFilterChanged.accept(criteria);
    }

    private void clearAll() {
        searchField.setText("");
        minCostField.setText("");
        maxCostField.setText("");
        magicOnlyCheck.setSelected(false);
        attunementOnlyCheck.setSelected(false);
        categoryFilter.clearSelection();
        subcategoryFilter.clearSelection();
        rarityFilter.clearSelection();
        tagFilter.clearSelection();
        sourceFilter.clearSelection();
        fireChange();
    }

    private void rebuildChips(ItemCatalogService.FilterCriteria criteria) {
        chipsPane.getChildren().clear();
        if (criteria.nameQuery() != null) {
            chipsPane.getChildren().add(makeChip("Suche: " + criteria.nameQuery(), "chip-item-search", () -> {
                searchField.setText("");
                fireChange();
            }));
        }
        if (criteria.minCostCp() != null || criteria.maxCostCp() != null) {
            String text = "Wert: "
                    + (criteria.minCostCp() != null ? criteria.minCostCp() : "0")
                    + "-"
                    + (criteria.maxCostCp() != null ? criteria.maxCostCp() : "\u221e")
                    + " cp";
            chipsPane.getChildren().add(makeChip(text, "chip-item-cost", () -> {
                minCostField.setText("");
                maxCostField.setText("");
                fireChange();
            }));
        }
        if (criteria.magicOnly()) {
            chipsPane.getChildren().add(makeChip("Magisch", "chip-item-magic", () -> {
                magicOnlyCheck.setSelected(false);
                fireChange();
            }));
        }
        if (criteria.attunementOnly()) {
            chipsPane.getChildren().add(makeChip("Einstimmung", "chip-item-attunement", () -> {
                attunementOnlyCheck.setSelected(false);
                fireChange();
            }));
        }
        addFilterChips(criteria.categories(), "chip-item-category", categoryFilter);
        addFilterChips(criteria.subcategories(), "chip-item-subcategory", subcategoryFilter);
        addFilterChips(criteria.rarities(), "chip-item-rarity", rarityFilter);
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

    private static Integer parseIntOrNull(String value) {
        String normalized = normalize(value);
        if (normalized == null) return null;
        try {
            int parsed = Integer.parseInt(normalized);
            return parsed >= 0 ? parsed : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
