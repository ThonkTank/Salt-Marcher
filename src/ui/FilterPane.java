package ui;

import ui.components.CheckboxFilterSection;
import ui.components.CrRangeSelector;
import javafx.animation.PauseTransition;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
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

    private Consumer<FilterCriteria> listener;

    private final TextField searchField;
    private final CrRangeSelector crRange;
    private final CheckboxFilterSection sizeSection;
    private final CheckboxFilterSection typeSection;
    private final CheckboxFilterSection subtypeSection;
    private final CheckboxFilterSection biomeSection;
    private final CheckboxFilterSection alignmentSection;
    private final FlowPane chipsPane;
    private final List<String> crValues;

    public FilterPane(FilterData data) {
        getStyleClass().add("filter-pane");
        setPrefWidth(220);
        setMinWidth(180);

        crValues = data.crValues();

        VBox content = new VBox(4);
        content.setPadding(new Insets(8));

        Label title = new Label("Filter");
        title.getStyleClass().add("title");

        searchField = new TextField();
        searchField.setPromptText("Monster suchen...");

        PauseTransition debounce = new PauseTransition(Duration.millis(300));
        debounce.setOnFinished(e -> fireChange());
        searchField.textProperty().addListener((obs, o, n) -> debounce.playFromStart());

        crRange = new CrRangeSelector(crValues, (min, max) -> fireChange());

        sizeSection      = new CheckboxFilterSection("Groesse", data.sizes(), vals -> fireChange());
        typeSection      = new CheckboxFilterSection("Typ", data.types(), vals -> fireChange());
        subtypeSection   = new CheckboxFilterSection("Unterart", data.subtypes(), vals -> fireChange());
        biomeSection     = new CheckboxFilterSection("Umgebung", data.biomes(), vals -> fireChange());
        alignmentSection = new CheckboxFilterSection("Gesinnung", data.alignments(), vals -> fireChange());

        chipsPane = new FlowPane(4, 2);

        Button clearButton = new Button("Filter leeren");
        clearButton.setMaxWidth(Double.MAX_VALUE);
        clearButton.setOnAction(e -> clearAll());

        content.getChildren().addAll(
                title, searchField, crRange,
                sizeSection, typeSection, subtypeSection, biomeSection, alignmentSection,
                chipsPane, clearButton
        );

        ScrollPane scroll = new ScrollPane(content);
        scroll.setFitToWidth(true);
        scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(scroll, Priority.ALWAYS);
        getChildren().add(scroll);
    }

    public void setOnFilterChanged(Consumer<FilterCriteria> listener) {
        this.listener = listener;
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

        c.sizes      = sizeSection.getSelectedValues();
        c.types      = typeSection.getSelectedValues();
        c.subtypes   = subtypeSection.getSelectedValues();
        c.biomes     = biomeSection.getSelectedValues();
        c.alignments = alignmentSection.getSelectedValues();
        return c;
    }

    private void fireChange() {
        rebuildChips();
        if (listener != null) listener.accept(buildCriteria());
    }

    private void clearAll() {
        searchField.setText("");
        crRange.reset();
        sizeSection.clearSelection();
        typeSection.clearSelection();
        subtypeSection.clearSelection();
        biomeSection.clearSelection();
        alignmentSection.clearSelection();
        fireChange();
    }

    private void rebuildChips() {
        chipsPane.getChildren().clear();
        FilterCriteria c = buildCriteria();

        if (c.crMin != null || c.crMax != null) {
            String label = "CR: " + (c.crMin != null ? c.crMin : "0")
                    + "-" + (c.crMax != null ? c.crMax : "30");
            chipsPane.getChildren().add(makeChip(label, "chip-cr", () -> { crRange.reset(); fireChange(); }));
        }
        for (String s : c.sizes)      chipsPane.getChildren().add(makeChip(s, "chip-size", null));
        for (String t : c.types)      chipsPane.getChildren().add(makeChip(t, "chip-type", null));
        for (String st : c.subtypes)  chipsPane.getChildren().add(makeChip(st, "chip-subtype", null));
        for (String b : c.biomes)     chipsPane.getChildren().add(makeChip(b, "chip-biome", null));
        for (String a : c.alignments) chipsPane.getChildren().add(makeChip(a, "chip-align", null));
    }

    private HBox makeChip(String text, String styleClass, Runnable onRemove) {
        HBox chip = new HBox(2);
        chip.getStyleClass().addAll("chip", styleClass);
        Label label = new Label(text);
        chip.getChildren().add(label);
        if (onRemove != null) {
            Label x = new Label("\u00d7");
            x.getStyleClass().add("text-secondary");
            x.setCursor(javafx.scene.Cursor.HAND);
            x.setOnMouseClicked(e -> onRemove.run());
            chip.getChildren().add(x);
        }
        return chip;
    }
}
