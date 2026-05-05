package src.view.leftbartabs.catalog;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class CatalogControlsView extends VBox {

    private static final String FILTER_SECTION_TITLE = "FILTER";
    private static final String ENCOUNTER_SECTION_TITLE = "ENCOUNTER";
    private static final String STYLE_SECTION_HEADER = "section-header";
    private static final String STYLE_TEXT_MUTED = "text-muted";

    private final CatalogEncounterTablePicker encounterTablePicker =
            new CatalogEncounterTablePicker(this::fireEncounterTablesChanged);
    private final CatalogFilterStripSection filterStrip =
            new CatalogFilterStripSection(encounterTablePicker, this::fireFilterChanged);
    private final CatalogFilterChipsStrip chipsView =
            new CatalogFilterChipsStrip(this::clearChip);
    private final CatalogEncounterTuningSection tuningView =
            new CatalogEncounterTuningSection(
                    this::fireEncounterDifficultyChanged,
                    this::fireEncounterTuningChanged);

    private Consumer<CatalogControlsViewInputEvent> viewInputEventHandler = ignored -> { };
    private List<CatalogFilterChipsStrip.FilterChipView> activeFilterChips = List.of();
    private int suppressedFilterEventDepth;

    public CatalogControlsView() {
        setSpacing(0);
        setPadding(new Insets(0));

        VBox filterRegion = new VBox(filterStrip, chipsView);
        filterRegion.getStyleClass().add("surface-root");
        filterRegion.setPadding(new Insets(6, 8, 6, 8));

        VBox filterSection = new VBox(0, sectionHeader(FILTER_SECTION_TITLE), paddedSection(filterRegion));
        VBox encounterSection = new VBox(0, sectionHeader(ENCOUNTER_SECTION_TITLE), tuningView);
        getChildren().setAll(filterSection, controlSeparator(), encounterSection);
        setMaxHeight(Double.MAX_VALUE);
    }

    void setCreatureFilterData(CatalogFilterStripSection.CreatureFilterData data) {
        runWithSuppressedFilterEvents(() -> filterStrip.setCreatureFilterData(data));
    }

    void setChips(List<CatalogFilterChipsStrip.FilterChipView> chips) {
        activeFilterChips = chips == null ? List.of() : List.copyOf(chips);
        renderChips();
    }

    void setEncounterTables(List<CatalogEncounterTablePicker.EncounterTableSelection> tables) {
        encounterTablePicker.setEncounterTables(tables);
        renderChips();
    }

    void selectEncounterTables(List<Long> tableIds) {
        encounterTablePicker.selectEncounterTables(tableIds);
        renderChips();
    }

    void onViewInputEvent(Consumer<CatalogControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    void setEncounterTuningPreview(CatalogEncounterTuningSection.EncounterTuningPreview preview) {
        tuningView.setEncounterTuningPreview(preview);
    }

    void applyEncounterBuilderInputs(
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            String difficultyKey,
            CatalogEncounterTuningSection.EncounterTuningSelection tuning,
            List<Long> encounterTableIds
    ) {
        runWithSuppressedFilterEvents(() -> {
            filterStrip.applyEncounterBuilderFilters(types, subtypes, biomes);
            tuningView.applyEncounterBuilderInputs(difficultyKey, tuning);
            encounterTablePicker.selectEncounterTables(encounterTableIds);
        });
        renderChips();
    }

    private void renderChips() {
        List<CatalogFilterChipsStrip.FilterChipView> allChips = new ArrayList<>(activeFilterChips);
        allChips.addAll(encounterTablePicker.selectedTableChips());
        chipsView.setChips(allChips);
    }

    private void clearChip(String key) {
        if (filterStrip.clearFilterChip(key)) {
            fireFilterChanged();
            return;
        }
        if (encounterTablePicker.clearEncounterTableChip(key)) {
            renderChips();
            fireEncounterTablesChanged();
        }
    }

    private void fireFilterChanged() {
        if (filterEventsSuppressed()) {
            return;
        }
        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                true,
                false,
                false,
                false,
                toPublishedFilterState(filterStrip.buildFilterState()),
                "",
                CatalogControlsViewInputEvent.EncounterTuning.empty(),
                List.of()));
    }

    private void fireEncounterDifficultyChanged() {
        if (filterEventsSuppressed()) {
            return;
        }
        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                false,
                true,
                false,
                false,
                CatalogControlsViewInputEvent.FilterPayload.empty(),
                tuningView.difficultyKey(),
                CatalogControlsViewInputEvent.EncounterTuning.empty(),
                List.of()));
    }

    private void fireEncounterTuningChanged() {
        if (filterEventsSuppressed()) {
            return;
        }
        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                false,
                false,
                true,
                false,
                CatalogControlsViewInputEvent.FilterPayload.empty(),
                "",
                tuningView.toInputEventTuning(),
                List.of()));
    }

    private void fireEncounterTablesChanged() {
        if (filterEventsSuppressed()) {
            return;
        }
        renderChips();
        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                false,
                false,
                false,
                true,
                CatalogControlsViewInputEvent.FilterPayload.empty(),
                "",
                CatalogControlsViewInputEvent.EncounterTuning.empty(),
                encounterTablePicker.selectedEncounterTableIds()));
    }

    private void runWithSuppressedFilterEvents(Runnable action) {
        suppressedFilterEventDepth++;
        try {
            action.run();
        } finally {
            suppressedFilterEventDepth--;
        }
    }

    private boolean filterEventsSuppressed() {
        return suppressedFilterEventDepth > 0;
    }

    private static CatalogControlsViewInputEvent.FilterPayload toPublishedFilterState(
            CatalogFilterStripSection.CreatureFilterState filterState
    ) {
        CatalogFilterStripSection.CreatureFilterState safeState = filterState == null
                ? CatalogFilterStripSection.CreatureFilterState.empty()
                : filterState;
        return new CatalogControlsViewInputEvent.FilterPayload(
                safeState.nameQuery(),
                safeState.challengeRatingMin(),
                safeState.challengeRatingMax(),
                safeState.sizes(),
                safeState.types(),
                safeState.subtypes(),
                safeState.biomes(),
                safeState.alignments());
    }

    private static Label sectionHeader(String text) {
        Label header = new Label(text);
        header.getStyleClass().addAll(STYLE_SECTION_HEADER, STYLE_TEXT_MUTED);
        return header;
    }

    private static VBox paddedSection(VBox content) {
        VBox wrapper = new VBox(content);
        wrapper.setPadding(new Insets(0, 4, 0, 4));
        return wrapper;
    }

    private static Region controlSeparator() {
        Region separator = new Region();
        separator.getStyleClass().add("control-separator");
        return separator;
    }
}
