package src.view.creatures.View;

import javafx.animation.PauseTransition;
import javafx.collections.ObservableList;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import org.jspecify.annotations.Nullable;
import src.view.creatures.Model.CreatureFilterOptionsViewData;
import src.view.creatures.Model.CreaturesFilterSelectionModel;

import java.util.List;
import java.util.Objects;

public final class CreatureFilterPane extends VBox {

    private final CreaturesFilterSelectionModel selection;
    private final @Nullable Runnable onFilterChanged;
    private final FilterPaneConfig config;
    private final @Nullable SearchableFilterButton sizeFilter;
    private final @Nullable SearchableFilterButton typeFilter;
    private final @Nullable SearchableFilterButton subtypeFilter;
    private final @Nullable SearchableFilterButton biomeFilter;
    private final @Nullable SearchableFilterButton alignmentFilter;
    private final FlowPane chipsPane = new FlowPane(4, 2);

    public CreatureFilterPane(
            CreatureFilterOptionsViewData options,
            CreaturesFilterSelectionModel selection,
            FilterPaneConfig config,
            @Nullable Runnable onFilterChanged
    ) {
        this.selection = Objects.requireNonNull(selection, "selection");
        this.config = Objects.requireNonNull(config, "config");
        this.onFilterChanged = onFilterChanged;

        getStyleClass().add("filter-pane");
        setSpacing(4);
        setPadding(new javafx.geometry.Insets(6, 8, 6, 8));

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

        VBox rows = new VBox(4);
        if (config.showSearch()) {
            rows.getChildren().add(buildSearchRow());
        }
        FlowPane filterRow = buildFilterRow(options);
        chipsPane.setMinHeight(24);
        filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        rows.getChildren().addAll(filterRow, chipsPane);
        getChildren().add(rows);
        rebuildChips();
    }

    private FlowPane buildFilterRow(CreatureFilterOptionsViewData options) {
        FlowPane filterRow = new FlowPane(4, 4);
        if (config.showChallengeRating()) {
            filterRow.getChildren().add(new ChallengeRatingRangeControl(
                    options.challengeRatings(),
                    selection.selectedChallengeRatingMinProperty(),
                    selection.selectedChallengeRatingMaxProperty(),
                    this::fireChange));
        }
        CreatureFilterPaneSupport.addIfPresent(filterRow, sizeFilter);
        CreatureFilterPaneSupport.addIfPresent(filterRow, typeFilter);
        CreatureFilterPaneSupport.addIfPresent(filterRow, subtypeFilter);
        CreatureFilterPaneSupport.addIfPresent(filterRow, biomeFilter);
        CreatureFilterPaneSupport.addIfPresent(filterRow, alignmentFilter);
        filterRow.getChildren().add(clearButton());
        return filterRow;
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
        CreatureFilterPaneSupport.clearSelection(sizeFilter);
        CreatureFilterPaneSupport.clearSelection(typeFilter);
        CreatureFilterPaneSupport.clearSelection(subtypeFilter);
        CreatureFilterPaneSupport.clearSelection(biomeFilter);
        CreatureFilterPaneSupport.clearSelection(alignmentFilter);
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
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selection.selectedSizes(), "chip-size", sizeFilter, this::syncAndFire);
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selection.selectedTypes(), "chip-type", typeFilter, this::syncAndFire);
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selection.selectedSubtypes(), "chip-subtype", subtypeFilter, this::syncAndFire);
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selection.selectedBiomes(), "chip-biome", biomeFilter, this::syncAndFire);
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selection.selectedAlignments(), "chip-align", alignmentFilter, this::syncAndFire);
    }

    private HBox makeChip(String text, String styleClass, Runnable onRemove) {
        return CreatureFilterPaneSupport.makeChip(text, styleClass, onRemove);
    }

    private static void syncSelection(ObservableList<String> target, @Nullable SearchableFilterButton button) {
        CreatureFilterPaneSupport.syncSelection(target, button);
    }

    private javafx.scene.control.Button clearButton() {
        javafx.scene.control.Button clearButton = new javafx.scene.control.Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(event -> clearAll());
        return clearButton;
    }
}
