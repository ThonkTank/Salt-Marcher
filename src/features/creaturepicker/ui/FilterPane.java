package features.creaturepicker.ui;

import javafx.animation.PauseTransition;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import features.creaturecatalog.service.CreatureService;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;
import ui.components.CrRangeSelector;
import ui.components.SearchableFilterButton;

/**
 * Filter bar for the monster database: name search, CR range, and five
 * multi-select category filters (size, type, subtype, biome, alignment).
 * Requires a pre-loaded {@link features.creaturecatalog.service.CreatureService.FilterOptions} for the
 * combo box contents. Register a listener via {@link #setOnFilterChanged} to
 * receive live updates; call {@link #buildCriteria()} to read the current state.
 *
 * <p>Layout: [search field] / [CR + filter buttons] / [active filter chips]
 *
 * <p>Owned by the creature picker feature and shared by encounter-facing screens.
 */
public class FilterPane extends VBox {

    private Consumer<CreatureService.FilterCriteria> onFilterChanged;
    private Supplier<List<Node>> externalChipSource = null;

    private final TextField searchField;
    private final CrRangeSelector crRange;
    private final SearchableFilterButton sizeFilter;
    private final SearchableFilterButton typeFilter;
    private final SearchableFilterButton subtypeFilter;
    private final SearchableFilterButton biomeFilter;
    private final SearchableFilterButton alignFilter;
    private final FlowPane filterRow;
    private final FlowPane chipsPane;
    private final List<String> crValues;

    public FilterPane(CreatureService.FilterOptions data) {
        getStyleClass().add("filter-pane");
        setSpacing(4);
        setPadding(new Insets(6, 8, 6, 8));

        crValues = data.crValues();

        // Search field with debounce
        searchField = new TextField();
        searchField.setPromptText("Monster suchen...");
        searchField.setMaxWidth(Double.MAX_VALUE);

        PauseTransition debounce = new PauseTransition(Duration.millis(300));
        debounce.setOnFinished(e -> fireChange());
        searchField.textProperty().addListener((obs, o, n) -> debounce.playFromStart());

        // CR range
        crRange = new CrRangeSelector(crValues, (min, max) -> fireChange());

        // Searchable filter buttons
        sizeFilter    = new SearchableFilterButton("Gr\u00f6\u00dfe",  data.sizes(),      vals -> fireChange());
        typeFilter    = new SearchableFilterButton("Typ",       data.types(),      vals -> fireChange());
        subtypeFilter = new SearchableFilterButton("Unterart",  data.subtypes(),   vals -> fireChange());
        biomeFilter   = new SearchableFilterButton("Umgebung",  data.biomes(),     vals -> fireChange());
        alignFilter   = new SearchableFilterButton("Gesinnung", data.alignments(), vals -> fireChange());

        // Clear button
        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(e -> clearAll());

        // Row 1: search field
        HBox searchRow = new HBox(6, searchField);
        HBox.setHgrow(searchField, Priority.ALWAYS);

        // Row 2: filter triggers in a wrapping flow
        filterRow = new FlowPane(4, 4);
        filterRow.getChildren().addAll(
                crRange, sizeFilter, typeFilter, subtypeFilter,
                biomeFilter, alignFilter, clearButton);

        // Row 3: active filter chips
        chipsPane = new FlowPane(4, 2);
        chipsPane.setMinHeight(24);

        // Bind wrap widths so FlowPane can compute accurate preferred heights when chips wrap.
        // Without this, JavaFX underestimates pref height (uses unlimited width), causing overflow.
        filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.prefWrapLengthProperty().bind(widthProperty().subtract(16));

        getChildren().addAll(searchRow, filterRow, chipsPane);
    }

    /**
     * Registers a supplier for extra chip nodes appended after standard filter chips.
     * Called during every {@link #rebuildChips} (i.e. on every filter change).
     * Use {@link #refreshChips()} to force a chip rebuild without firing the filter callback.
     */
    public void setExternalChipSource(Supplier<List<Node>> source) {
        this.externalChipSource = source;
    }

    /** Rebuilds chips (including external chips) without firing the filter-changed callback. */
    public void refreshChips() {
        rebuildChips(buildCriteria());
    }

    /** Appends a node to the filter trigger row, just before the clear button. */
    public void addToFilterRow(Node node) {
        filterRow.getChildren().add(filterRow.getChildren().size() - 1, node);
    }

    public void setOnFilterChanged(Consumer<CreatureService.FilterCriteria> callback) {
        this.onFilterChanged = callback;
    }

    public CreatureService.FilterCriteria buildCriteria() {
        String name = searchField.getText().trim();
        if (name.isEmpty()) name = null;

        int maxIdx = crValues.size() - 1;
        String minCr = crRange.getMinCr();
        String maxCr = crRange.getMaxCr();
        // null means "no constraint": omit crMin when at index 0 (lowest possible), omit crMax when at last index
        String crMin = crValues.indexOf(minCr) > 0 ? minCr : null;
        String crMax = crValues.indexOf(maxCr) < maxIdx ? maxCr : null;

        return new CreatureService.FilterCriteria(name, crMin, crMax,
                sizeFilter.getSelectedValues(), typeFilter.getSelectedValues(),
                subtypeFilter.getSelectedValues(), biomeFilter.getSelectedValues(),
                alignFilter.getSelectedValues());
    }

    private void fireChange() {
        CreatureService.FilterCriteria c = buildCriteria();
        rebuildChips(c);
        if (onFilterChanged != null) onFilterChanged.accept(c);
    }

    private void clearAll() {
        searchField.setText("");
        crRange.reset();
        sizeFilter.clearSelection();
        typeFilter.clearSelection();
        subtypeFilter.clearSelection();
        biomeFilter.clearSelection();
        alignFilter.clearSelection();
        fireChange();
    }

    private void rebuildChips(CreatureService.FilterCriteria c) {
        chipsPane.getChildren().clear();

        if (c.crMin() != null || c.crMax() != null) {
            String label = "CR: " + (c.crMin() != null ? c.crMin() : "0")
                    + "-" + (c.crMax() != null ? c.crMax() : "30");
            chipsPane.getChildren().add(makeChip(label, "chip-cr", () -> { crRange.reset(); fireChange(); }));
        }
        addFilterChips(c.sizes(),      "chip-size",    sizeFilter);
        addFilterChips(c.types(),      "chip-type",    typeFilter);
        addFilterChips(c.subtypes(),   "chip-subtype", subtypeFilter);
        addFilterChips(c.biomes(),     "chip-biome",   biomeFilter);
        addFilterChips(c.alignments(), "chip-align",   alignFilter);
        if (externalChipSource != null) chipsPane.getChildren().addAll(externalChipSource.get());
    }

    private void addFilterChips(List<String> values, String cssClass, SearchableFilterButton filter) {
        for (String v : values) {
            chipsPane.getChildren().add(makeChip(v, cssClass, () -> { filter.removeValue(v); fireChange(); }));
        }
    }

    private HBox makeChip(String text, String styleClass, Runnable onRemove) {
        HBox chip = new HBox(2);
        chip.getStyleClass().addAll("chip", styleClass);
        Label label = new Label(text);
        chip.getChildren().add(label);
        Button x = new Button("\u00d7");
        x.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
        x.setAccessibleText("Entfernen: " + text);
        x.setOnAction(e -> { if (onRemove != null) onRemove.run(); });
        chip.getChildren().add(x);
        return chip;
    }
}
