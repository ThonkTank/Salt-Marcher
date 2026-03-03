package ui;

import ui.components.CrRangeSelector;
import ui.components.SearchableFilterButton;
import javafx.animation.PauseTransition;
import javafx.geometry.Insets;
import javafx.scene.AccessibleRole;
import javafx.scene.Cursor;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class FilterPane extends VBox {

    public record FilterData(List<String> sizes, List<String> types,
                             List<String> subtypes, List<String> biomes,
                             List<String> alignments, List<String> crValues) {}

    public static class FilterCriteria {
        public String nameQuery;
        public String crMin;
        public String crMax;
        public List<String> sizes      = new ArrayList<>();
        public List<String> types      = new ArrayList<>();
        public List<String> subtypes   = new ArrayList<>();
        public List<String> biomes     = new ArrayList<>();
        public List<String> alignments = new ArrayList<>();
    }

    private Consumer<FilterCriteria> onFilterChanged;

    private final TextField searchField;
    private final CrRangeSelector crRange;
    private final SearchableFilterButton sizeFilter;
    private final SearchableFilterButton typeFilter;
    private final SearchableFilterButton subtypeFilter;
    private final SearchableFilterButton biomeFilter;
    private final SearchableFilterButton alignFilter;
    private final FlowPane chipsPane;
    private final List<String> crValues;

    public FilterPane(FilterData data) {
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
        sizeFilter    = new SearchableFilterButton("Groesse",  data.sizes(),      vals -> fireChange());
        typeFilter    = new SearchableFilterButton("Typ",       data.types(),      vals -> fireChange());
        subtypeFilter = new SearchableFilterButton("Unterart",  data.subtypes(),   vals -> fireChange());
        biomeFilter   = new SearchableFilterButton("Umgebung",  data.biomes(),     vals -> fireChange());
        alignFilter   = new SearchableFilterButton("Gesinnung", data.alignments(), vals -> fireChange());

        // Clear button
        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().add("compact");
        clearButton.setOnAction(e -> clearAll());

        // Row 1: search field
        HBox searchRow = new HBox(6, searchField);
        HBox.setHgrow(searchField, Priority.ALWAYS);

        // Row 2: filter triggers in a wrapping flow
        FlowPane filterRow = new FlowPane(4, 4);
        filterRow.getChildren().addAll(
                crRange, sizeFilter, typeFilter, subtypeFilter,
                biomeFilter, alignFilter, clearButton);

        // Row 3: active filter chips
        chipsPane = new FlowPane(4, 2);
        chipsPane.setMinHeight(24);

        getChildren().addAll(searchRow, filterRow, chipsPane);
    }

    public void setOnFilterChanged(Consumer<FilterCriteria> callback) {
        this.onFilterChanged = callback;
    }

    public FilterCriteria buildCriteria() {
        FilterCriteria c = new FilterCriteria();
        c.nameQuery = searchField.getText().trim();
        if (c.nameQuery.isEmpty()) c.nameQuery = null;

        int maxIdx = crValues.size() - 1;
        String minCr = crRange.getMinCr();
        String maxCr = crRange.getMaxCr();
        if (crValues.indexOf(minCr) > 0) c.crMin = minCr;
        if (crValues.indexOf(maxCr) < maxIdx) c.crMax = maxCr;

        c.sizes      = sizeFilter.getSelectedValues();
        c.types      = typeFilter.getSelectedValues();
        c.subtypes   = subtypeFilter.getSelectedValues();
        c.biomes     = biomeFilter.getSelectedValues();
        c.alignments = alignFilter.getSelectedValues();
        return c;
    }

    private void fireChange() {
        FilterCriteria c = buildCriteria();
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

    private void rebuildChips(FilterCriteria c) {
        chipsPane.getChildren().clear();

        if (c.crMin != null || c.crMax != null) {
            String label = "CR: " + (c.crMin != null ? c.crMin : "0")
                    + "-" + (c.crMax != null ? c.crMax : "30");
            chipsPane.getChildren().add(makeChip(label, "chip-cr", () -> { crRange.reset(); fireChange(); }));
        }
        for (String s : c.sizes)      chipsPane.getChildren().add(makeChip(s, "chip-size",    () -> { sizeFilter.removeValue(s);    fireChange(); }));
        for (String t : c.types)      chipsPane.getChildren().add(makeChip(t, "chip-type",    () -> { typeFilter.removeValue(t);    fireChange(); }));
        for (String st : c.subtypes)  chipsPane.getChildren().add(makeChip(st, "chip-subtype", () -> { subtypeFilter.removeValue(st); fireChange(); }));
        for (String b : c.biomes)     chipsPane.getChildren().add(makeChip(b, "chip-biome",   () -> { biomeFilter.removeValue(b);   fireChange(); }));
        for (String a : c.alignments) chipsPane.getChildren().add(makeChip(a, "chip-align",   () -> { alignFilter.removeValue(a);   fireChange(); }));
    }

    private HBox makeChip(String text, String styleClass, Runnable onRemove) {
        HBox chip = new HBox(2);
        chip.getStyleClass().addAll("chip", styleClass);
        Label label = new Label(text);
        chip.getChildren().add(label);
        Label x = new Label("\u00d7");
        x.getStyleClass().add("text-secondary");
        x.setCursor(Cursor.HAND);
        x.setFocusTraversable(true);
        x.setAccessibleRole(AccessibleRole.BUTTON);
        x.setAccessibleText("Entfernen: " + text);
        x.setOnMouseClicked(e -> { if (onRemove != null) onRemove.run(); });
        x.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ENTER || e.getCode() == KeyCode.SPACE) {
                if (onRemove != null) onRemove.run();
                e.consume();
            }
        });
        chip.getChildren().add(x);
        return chip;
    }
}
