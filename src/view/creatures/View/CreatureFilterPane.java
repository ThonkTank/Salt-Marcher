package src.view.creatures.View;

import javafx.animation.PauseTransition;
import javafx.geometry.Insets;
import javafx.collections.ObservableList;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import src.view.creatures.Model.CreatureFilterOptionsViewData;
import src.view.creatures.Model.CreaturesFilterSelectionModel;

import java.util.List;
import java.util.Objects;

public final class CreatureFilterPane extends VBox {

    private final CreaturesFilterSelectionModel selection;
    private final Runnable onFilterChanged;
    private final FilterPaneConfig config;
    private final SearchableFilterButton sizeFilter;
    private final SearchableFilterButton typeFilter;
    private final SearchableFilterButton subtypeFilter;
    private final SearchableFilterButton biomeFilter;
    private final SearchableFilterButton alignmentFilter;
    private final FlowPane chipsPane = new FlowPane(4, 2);

    public CreatureFilterPane(
            CreatureFilterOptionsViewData options,
            CreaturesFilterSelectionModel selection,
            FilterPaneConfig config,
            Runnable onFilterChanged
    ) {
        this.selection = Objects.requireNonNull(selection, "selection");
        this.config = Objects.requireNonNull(config, "config");
        this.onFilterChanged = onFilterChanged;

        getStyleClass().add("filter-pane");
        setSpacing(4);
        setPadding(new Insets(6, 8, 6, 8));

        VBox rows = new VBox(4);
        if (config.showSearch()) {
            rows.getChildren().add(buildSearchRow());
        }

        FlowPane filterRow = new FlowPane(4, 4);
        if (config.showChallengeRating()) {
            filterRow.getChildren().add(new ChallengeRatingRangeControl(
                    options.challengeRatings(),
                    selection.selectedChallengeRatingMinProperty(),
                    selection.selectedChallengeRatingMaxProperty(),
                    this::fireChange));
        }

        sizeFilter = config.showSize()
                ? new SearchableFilterButton("Größe", options.sizes(), selection.selectedSizes(), this::syncAndFire)
                : null;
        typeFilter = config.showType()
                ? new SearchableFilterButton("Typ", options.types(), selection.selectedTypes(), this::syncAndFire)
                : null;
        subtypeFilter = config.showSubtype()
                ? new SearchableFilterButton("Unterart", options.subtypes(), selection.selectedSubtypes(), this::syncAndFire)
                : null;
        biomeFilter = config.showBiome()
                ? new SearchableFilterButton("Umgebung", options.biomes(), selection.selectedBiomes(), this::syncAndFire)
                : null;
        alignmentFilter = config.showAlignment()
                ? new SearchableFilterButton("Gesinnung", options.alignments(), selection.selectedAlignments(), this::syncAndFire)
                : null;

        addIfPresent(filterRow, sizeFilter);
        addIfPresent(filterRow, typeFilter);
        addIfPresent(filterRow, subtypeFilter);
        addIfPresent(filterRow, biomeFilter);
        addIfPresent(filterRow, alignmentFilter);

        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(event -> clearAll());
        filterRow.getChildren().add(clearButton);

        chipsPane.setMinHeight(24);
        filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        rows.getChildren().addAll(filterRow, chipsPane);
        getChildren().add(rows);
        rebuildChips();
    }

    private HBox buildSearchRow() {
        TextField searchField = new TextField();
        searchField.setPromptText("Monster suchen...");
        searchField.setMaxWidth(Double.MAX_VALUE);
        searchField.textProperty().bindBidirectional(selection.searchTextProperty());

        PauseTransition debounce = new PauseTransition(Duration.millis(300));
        debounce.setOnFinished(event -> fireChange());
        searchField.textProperty().addListener((ignored, before, after) -> debounce.playFromStart());

        HBox row = new HBox(6, searchField);
        HBox.setHgrow(searchField, Priority.ALWAYS);
        return row;
    }

    private void syncAndFire() {
        syncSelections();
        fireChange();
    }

    private void syncSelections() {
        syncSelection(selection.selectedSizes(), sizeFilter);
        syncSelection(selection.selectedTypes(), typeFilter);
        syncSelection(selection.selectedSubtypes(), subtypeFilter);
        syncSelection(selection.selectedBiomes(), biomeFilter);
        syncSelection(selection.selectedAlignments(), alignmentFilter);
    }

    private void fireChange() {
        rebuildChips();
        if (onFilterChanged != null) {
            onFilterChanged.run();
        }
    }

    private void clearAll() {
        selection.searchTextProperty().set("");
        selection.selectedChallengeRatingMinProperty().set(null);
        selection.selectedChallengeRatingMaxProperty().set(null);
        clearSelection(sizeFilter);
        clearSelection(typeFilter);
        clearSelection(subtypeFilter);
        clearSelection(biomeFilter);
        clearSelection(alignmentFilter);
        syncSelections();
        fireChange();
    }

    private void rebuildChips() {
        chipsPane.getChildren().clear();
        if (config.showChallengeRating()) {
            String minimum = selection.selectedChallengeRatingMinProperty().get();
            String maximum = selection.selectedChallengeRatingMaxProperty().get();
            if (minimum != null || maximum != null) {
                String label = "CR: " + (minimum == null ? "0" : minimum)
                        + "-" + (maximum == null ? "30" : maximum);
                chipsPane.getChildren().add(makeChip(label, "chip-cr", () -> {
                    selection.selectedChallengeRatingMinProperty().set(null);
                    selection.selectedChallengeRatingMaxProperty().set(null);
                    fireChange();
                }));
            }
        }
        addFilterChips(selection.selectedSizes(), "chip-size", sizeFilter);
        addFilterChips(selection.selectedTypes(), "chip-type", typeFilter);
        addFilterChips(selection.selectedSubtypes(), "chip-subtype", subtypeFilter);
        addFilterChips(selection.selectedBiomes(), "chip-biome", biomeFilter);
        addFilterChips(selection.selectedAlignments(), "chip-align", alignmentFilter);
    }

    private void addFilterChips(List<String> values, String styleClass, SearchableFilterButton button) {
        if (button == null) {
            return;
        }
        for (String value : values) {
            chipsPane.getChildren().add(makeChip(value, styleClass, () -> {
                button.removeValue(value);
                syncSelections();
                fireChange();
            }));
        }
    }

    private HBox makeChip(String text, String styleClass, Runnable onRemove) {
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

    private static void addIfPresent(FlowPane row, SearchableFilterButton button) {
        if (button != null) {
            row.getChildren().add(button);
        }
    }

    private static void syncSelection(ObservableList<String> target, SearchableFilterButton button) {
        if (button == null) {
            target.clear();
            return;
        }
        target.setAll(button.selectedValues());
    }

    private static void clearSelection(SearchableFilterButton button) {
        if (button != null) {
            button.clearSelection();
        }
    }
}
