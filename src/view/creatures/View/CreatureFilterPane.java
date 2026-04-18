package src.view.creatures.View;

import javafx.animation.PauseTransition;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import org.jspecify.annotations.Nullable;
import src.view.creatures.ViewModel.CreatureFilterSelection;
import src.view.creatures.ViewModel.CreatureFilterOptionsViewData;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class CreatureFilterPane extends VBox {

    private final StringProperty searchText = new SimpleStringProperty("");
    private final ObjectProperty<String> selectedChallengeRatingMin = new SimpleObjectProperty<>();
    private final ObjectProperty<String> selectedChallengeRatingMax = new SimpleObjectProperty<>();
    private final ObservableList<String> selectedSizes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedTypes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedSubtypes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedBiomes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedAlignments = FXCollections.observableArrayList();
    private final @Nullable Consumer<CreatureFilterSelection> onFilterChanged;
    private final FilterPaneConfig config;
    private final @Nullable SearchableFilterButton sizeFilter;
    private final @Nullable SearchableFilterButton typeFilter;
    private final @Nullable SearchableFilterButton subtypeFilter;
    private final @Nullable SearchableFilterButton biomeFilter;
    private final @Nullable SearchableFilterButton alignmentFilter;
    private final FlowPane chipsPane = new FlowPane(4, 2);

    public CreatureFilterPane(
            CreatureFilterOptionsViewData options,
            FilterPaneConfig config,
            @Nullable Consumer<CreatureFilterSelection> onFilterChanged
    ) {
        this.config = Objects.requireNonNull(config, "config");
        this.onFilterChanged = onFilterChanged;

        getStyleClass().add("filter-pane");
        setSpacing(4);
        setPadding(new javafx.geometry.Insets(6, 8, 6, 8));

        sizeFilter = config.showSize()
                ? new SearchableFilterButton("Größe", options.sizes(), selectedSizes, this::syncAndFire)
                : null;
        typeFilter = config.showType()
                ? new SearchableFilterButton("Typ", options.types(), selectedTypes, this::syncAndFire)
                : null;
        subtypeFilter = config.showSubtype()
                ? new SearchableFilterButton("Unterart", options.subtypes(), selectedSubtypes, this::syncAndFire)
                : null;
        biomeFilter = config.showBiome()
                ? new SearchableFilterButton("Umgebung", options.biomes(), selectedBiomes, this::syncAndFire)
                : null;
        alignmentFilter = config.showAlignment()
                ? new SearchableFilterButton("Gesinnung", options.alignments(), selectedAlignments, this::syncAndFire)
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
                    selectedChallengeRatingMin,
                    selectedChallengeRatingMax,
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
        searchField.textProperty().bindBidirectional(searchText);

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
        CreatureFilterPaneSupport.syncSelection(selectedSizes, sizeFilter);
        CreatureFilterPaneSupport.syncSelection(selectedTypes, typeFilter);
        CreatureFilterPaneSupport.syncSelection(selectedSubtypes, subtypeFilter);
        CreatureFilterPaneSupport.syncSelection(selectedBiomes, biomeFilter);
        CreatureFilterPaneSupport.syncSelection(selectedAlignments, alignmentFilter);
    }

    private void fireChange() {
        rebuildChips();
        if (onFilterChanged != null) {
            onFilterChanged.accept(currentSelection());
        }
    }

    private void clearAll() {
        searchText.set("");
        selectedChallengeRatingMin.set(null);
        selectedChallengeRatingMax.set(null);
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
            String minimum = selectedChallengeRatingMin.get();
            String maximum = selectedChallengeRatingMax.get();
            if (minimum != null || maximum != null) {
                String label = "CR: " + (minimum == null ? "0" : minimum)
                        + "-" + (maximum == null ? "30" : maximum);
                chipsPane.getChildren().add(CreatureFilterPaneSupport.makeChip(label, "chip-cr", () -> {
                    selectedChallengeRatingMin.set(null);
                    selectedChallengeRatingMax.set(null);
                    fireChange();
                }));
            }
        }
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selectedSizes, "chip-size", sizeFilter, this::syncAndFire);
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selectedTypes, "chip-type", typeFilter, this::syncAndFire);
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selectedSubtypes, "chip-subtype", subtypeFilter, this::syncAndFire);
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selectedBiomes, "chip-biome", biomeFilter, this::syncAndFire);
        CreatureFilterPaneSupport.addFilterChips(chipsPane, selectedAlignments, "chip-align", alignmentFilter, this::syncAndFire);
    }

    private CreatureFilterSelection currentSelection() {
        return new CreatureFilterSelection(
                searchText.get(),
                selectedChallengeRatingMin.get(),
                selectedChallengeRatingMax.get(),
                List.copyOf(selectedSizes),
                List.copyOf(selectedTypes),
                List.copyOf(selectedSubtypes),
                List.copyOf(selectedBiomes),
                List.copyOf(selectedAlignments));
    }

    private javafx.scene.control.Button clearButton() {
        javafx.scene.control.Button clearButton = new javafx.scene.control.Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(event -> clearAll());
        return clearButton;
    }
}
