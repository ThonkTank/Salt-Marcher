package src.view.leftbartabs.catalog;

import javafx.animation.PauseTransition;
import javafx.scene.control.Button;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import org.jspecify.annotations.Nullable;

final class CatalogFilterStripView extends VBox {

    private static final String CLEAR_LABEL = "Leeren";
    private static final String SEARCH_KEY = "search";
    private static final String CHALLENGE_RATING_KEY = "cr";
    private static final String SIZE_PREFIX = "size:";
    private static final String TYPE_PREFIX = "type:";
    private static final String SUBTYPE_PREFIX = "subtype:";
    private static final String BIOME_PREFIX = "biome:";
    private static final String ALIGNMENT_PREFIX = "alignment:";

    private final Runnable onInteraction;
    private final PauseTransition debounce = new PauseTransition(Duration.millis(300));
    private final TextField searchField = new SearchField();
    private final CatalogCrRangeView crRange = new CatalogCrRangeView(this::emitInteraction);
    private final CatalogSearchableFilterView sizeFilter = new CatalogSearchableFilterView("Größe", this::emitInteraction);
    private final CatalogSearchableFilterView typeFilter = new CatalogSearchableFilterView("Typ", this::emitInteraction);
    private final CatalogSearchableFilterView subtypeFilter = new CatalogSearchableFilterView("Unterart", this::emitInteraction);
    private final CatalogSearchableFilterView biomeFilter = new CatalogSearchableFilterView("Umgebung", this::emitInteraction);
    private final CatalogSearchableFilterView alignmentFilter = new CatalogSearchableFilterView("Gesinnung", this::emitInteraction);

    private int internalUpdateDepth;

    CatalogFilterStripView(CatalogEncounterTablePickerView encounterTablePicker, Runnable onInteraction) {
        this.onInteraction = onInteraction;
        setSpacing(4);
        debounce.setOnFinished(event -> emitInteraction());
        searchField.textProperty().addListener((obs, oldValue, newValue) -> {
            if (internalUpdateDepth == 0) {
                debounce.playFromStart();
            }
        });
        getChildren().setAll(
                new SearchRow(searchField),
                new FilterRow(
                        crRange,
                        sizeFilter,
                        typeFilter,
                        subtypeFilter,
                        biomeFilter,
                        alignmentFilter,
                        encounterTablePicker,
                        new ClearButton(this::clearAndPublish)));
    }

    void applyProjection(Projection projection) {
        Projection safeProjection = projection == null ? Projection.empty() : projection;
        runSilently(() -> {
            CatalogContributionModel.FilterOptionsProjection filterOptions = safeProjection.filterOptions();
            CatalogContributionModel.CreatureFilters creatureFilters = safeProjection.creatureFilters();
            searchField.setText(creatureFilters.nameQuery());
            crRange.setValues(filterOptions.challengeRatings());
            crRange.applySelection(creatureFilters.challengeRatingMin(), creatureFilters.challengeRatingMax());
            sizeFilter.applyProjection(new CatalogSearchableFilterView.Projection(
                    filterOptions.sizes(),
                    creatureFilters.sizes(),
                    safeProjection.sizeDropdownState()));
            typeFilter.applyProjection(new CatalogSearchableFilterView.Projection(
                    filterOptions.types(),
                    creatureFilters.types(),
                    safeProjection.typeDropdownState()));
            subtypeFilter.applyProjection(new CatalogSearchableFilterView.Projection(
                    filterOptions.subtypes(),
                    creatureFilters.subtypes(),
                    safeProjection.subtypeDropdownState()));
            biomeFilter.applyProjection(new CatalogSearchableFilterView.Projection(
                    filterOptions.biomes(),
                    creatureFilters.biomes(),
                    safeProjection.biomeDropdownState()));
            alignmentFilter.applyProjection(new CatalogSearchableFilterView.Projection(
                    filterOptions.alignments(),
                    creatureFilters.alignments(),
                    safeProjection.alignmentDropdownState()));
        });
    }

    Snapshot snapshot() {
        CatalogCrRangeView.Selection crSelection = crRange.snapshot();
        return new Snapshot(
                new CatalogContributionModel.CreatureFilters(
                        normalized(searchField.getText()),
                        crSelection.minimumValue(),
                        crSelection.maximumValue(),
                        sizeFilter.snapshot().selectedValues(),
                        typeFilter.snapshot().selectedValues(),
                        subtypeFilter.snapshot().selectedValues(),
                        biomeFilter.snapshot().selectedValues(),
                        alignmentFilter.snapshot().selectedValues()),
                sizeFilter.snapshot().dropdownState(),
                typeFilter.snapshot().dropdownState(),
                subtypeFilter.snapshot().dropdownState(),
                biomeFilter.snapshot().dropdownState(),
                alignmentFilter.snapshot().dropdownState());
    }

    boolean clearChip(String key) {
        if (SEARCH_KEY.equals(key)) {
            searchField.setText("");
            return true;
        }
        if (CHALLENGE_RATING_KEY.equals(key)) {
            crRange.reset();
            return true;
        }
        if (clearSelectorChip(sizeFilter, key, SIZE_PREFIX)) {
            return true;
        }
        if (clearSelectorChip(typeFilter, key, TYPE_PREFIX)) {
            return true;
        }
        if (clearSelectorChip(subtypeFilter, key, SUBTYPE_PREFIX)) {
            return true;
        }
        if (clearSelectorChip(biomeFilter, key, BIOME_PREFIX)) {
            return true;
        }
        if (!key.startsWith(ALIGNMENT_PREFIX)) {
            return false;
        }
        alignmentFilter.removeValue(valuePart(key));
        return true;
    }

    record Projection(
            CatalogContributionModel.FilterOptionsProjection filterOptions,
            CatalogContributionModel.CreatureFilters creatureFilters,
            CatalogContributionModel.FilterDropdownState sizeDropdownState,
            CatalogContributionModel.FilterDropdownState typeDropdownState,
            CatalogContributionModel.FilterDropdownState subtypeDropdownState,
            CatalogContributionModel.FilterDropdownState biomeDropdownState,
            CatalogContributionModel.FilterDropdownState alignmentDropdownState
    ) {
        Projection {
            filterOptions = filterOptions == null ? CatalogContributionModel.FilterOptionsProjection.empty() : filterOptions;
            creatureFilters = creatureFilters == null ? CatalogContributionModel.CreatureFilters.empty() : creatureFilters;
            sizeDropdownState = sizeDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : sizeDropdownState;
            typeDropdownState = typeDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : typeDropdownState;
            subtypeDropdownState = subtypeDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : subtypeDropdownState;
            biomeDropdownState = biomeDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : biomeDropdownState;
            alignmentDropdownState = alignmentDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : alignmentDropdownState;
        }

        static Projection empty() {
            return new Projection(
                    CatalogContributionModel.FilterOptionsProjection.empty(),
                    CatalogContributionModel.CreatureFilters.empty(),
                    CatalogContributionModel.FilterDropdownState.closed(),
                    CatalogContributionModel.FilterDropdownState.closed(),
                    CatalogContributionModel.FilterDropdownState.closed(),
                    CatalogContributionModel.FilterDropdownState.closed(),
                    CatalogContributionModel.FilterDropdownState.closed());
        }
    }

    record Snapshot(
            CatalogContributionModel.CreatureFilters filters,
            CatalogContributionModel.FilterDropdownState sizeDropdownState,
            CatalogContributionModel.FilterDropdownState typeDropdownState,
            CatalogContributionModel.FilterDropdownState subtypeDropdownState,
            CatalogContributionModel.FilterDropdownState biomeDropdownState,
            CatalogContributionModel.FilterDropdownState alignmentDropdownState
    ) {
    }

    private void clearAndPublish() {
        runSilently(() -> {
            searchField.setText("");
            crRange.reset();
            sizeFilter.clearSelection();
            typeFilter.clearSelection();
            subtypeFilter.clearSelection();
            biomeFilter.clearSelection();
            alignmentFilter.clearSelection();
        });
        emitInteraction();
    }

    private boolean clearSelectorChip(CatalogSearchableFilterView filter, String key, String prefix) {
        if (!key.startsWith(prefix)) {
            return false;
        }
        filter.removeValue(valuePart(key));
        return true;
    }

    private void emitInteraction() {
        if (internalUpdateDepth == 0 && onInteraction != null) {
            onInteraction.run();
        }
    }

    private void runSilently(Runnable action) {
        internalUpdateDepth++;
        try {
            action.run();
        } finally {
            internalUpdateDepth--;
        }
    }

    private static String normalized(@Nullable String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private static String valuePart(String key) {
        int separator = key.indexOf(':');
        return separator < 0 ? key : key.substring(separator + 1);
    }

    private static final class SearchField extends TextField {

        SearchField() {
            setPromptText("Monster suchen...");
            setMaxWidth(Double.MAX_VALUE);
        }
    }

    private static final class SearchRow extends HBox {

        SearchRow(TextField searchField) {
            super(6, searchField);
            setHgrow(searchField, Priority.ALWAYS);
        }
    }

    private static final class FilterRow extends FlowPane {

        FilterRow(javafx.scene.Node... children) {
            super(4, 4, children);
            prefWrapLengthProperty().bind(widthProperty().subtract(16));
        }
    }

    private static final class ClearButton extends Button {

        ClearButton(Runnable action) {
            super(CLEAR_LABEL);
            getStyleClass().addAll("compact", "flat");
            setOnAction(event -> action.run());
        }
    }
}
