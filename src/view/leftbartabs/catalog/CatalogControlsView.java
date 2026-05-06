package src.view.leftbartabs.catalog;

import java.util.Objects;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class CatalogControlsView extends VBox {

    private static final String FILTER_SECTION_TITLE = "FILTER";
    private static final String ENCOUNTER_SECTION_TITLE = "ENCOUNTER";
    private static final String STYLE_SECTION_HEADER = "section-header";
    private static final String STYLE_TEXT_MUTED = "text-muted";

    private final CatalogContributionModel presentationModel;
    private final CatalogEncounterTablePickerView encounterTablePicker;
    private final CatalogFilterStripView filterStrip;
    private final CatalogFilterChipsView chipsView;
    private final CatalogEncounterTuningView tuningView;

    private Consumer<CatalogControlsViewInputEvent> viewInputEventHandler = ignored -> { };
    private int suppressedInputDepth;

    public CatalogControlsView(CatalogContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        encounterTablePicker = new CatalogEncounterTablePickerView(this::publishSnapshot);
        filterStrip = new CatalogFilterStripView(encounterTablePicker, this::publishSnapshot);
        chipsView = new CatalogFilterChipsView(this::clearChip);
        tuningView = new CatalogEncounterTuningView(this::publishSnapshot);

        setSpacing(0);
        setPadding(new Insets(0));
        setMaxHeight(Double.MAX_VALUE);
        getChildren().setAll(
                new SectionView(
                        FILTER_SECTION_TITLE,
                        new PaddedSection(new SurfaceSection(filterStrip, chipsView))),
                new ControlSeparator(),
                new SectionView(ENCOUNTER_SECTION_TITLE, tuningView));

        bindModel();
    }

    void onViewInputEvent(Consumer<CatalogControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void bindModel() {
        runWithSuppressedInput(() -> applyProjection(presentationModel.controlsProjectionProperty().get()));
        presentationModel.controlsProjectionProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> applyProjection(newValue)));
    }

    private void applyProjection(CatalogContributionModel.ControlsProjection projection) {
        CatalogContributionModel.ControlsProjection safeProjection = projection == null
                ? CatalogContributionModel.ControlsProjection.initial()
                : projection;
        filterStrip.applyProjection(new CatalogFilterStripView.Projection(
                safeProjection.filterOptions(),
                safeProjection.creatureFilters(),
                safeProjection.sizeDropdownState(),
                safeProjection.typeDropdownState(),
                safeProjection.subtypeDropdownState(),
                safeProjection.biomeDropdownState(),
                safeProjection.alignmentDropdownState()));
        CatalogContributionModel.ControlsState controlsState = safeProjection.controlsState();
        encounterTablePicker.applyProjection(new CatalogEncounterTablePickerView.Projection(
                safeProjection.encounterTableOptions(),
                controlsState.encounterTableIds(),
                safeProjection.encounterTableDropdownState().open()));
        tuningView.applyProjection(controlsState);
        chipsView.setChips(safeProjection.chips());
    }

    private void clearChip(String key) {
        if (filterStrip.clearChip(key) || encounterTablePicker.clearChip(key)) {
            publishSnapshot();
        }
    }

    private void publishSnapshot() {
        if (suppressedInputDepth > 0) {
            return;
        }

        CatalogFilterStripView.Snapshot filterSnapshot = filterStrip.snapshot();
        CatalogEncounterTablePickerView.Snapshot encounterTables = encounterTablePicker.snapshot();
        CatalogEncounterTuningView.Snapshot tuningSnapshot = tuningView.snapshot();
        CatalogContributionModel.CreatureFilters filters = filterSnapshot.filters();

        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                filters.nameQuery(),
                filters.challengeRatingMin(),
                filters.challengeRatingMax(),
                filters.sizes(),
                filters.types(),
                filters.subtypes(),
                filters.biomes(),
                filters.alignments(),
                filterSnapshot.sizeDropdownState().open(),
                filterSnapshot.sizeDropdownState().searchQuery(),
                filterSnapshot.typeDropdownState().open(),
                filterSnapshot.typeDropdownState().searchQuery(),
                filterSnapshot.subtypeDropdownState().open(),
                filterSnapshot.subtypeDropdownState().searchQuery(),
                filterSnapshot.biomeDropdownState().open(),
                filterSnapshot.biomeDropdownState().searchQuery(),
                filterSnapshot.alignmentDropdownState().open(),
                filterSnapshot.alignmentDropdownState().searchQuery(),
                encounterTables.popupOpen(),
                tuningSnapshot.difficultyAuto(),
                tuningSnapshot.difficultyValue(),
                tuningSnapshot.balanceAuto(),
                tuningSnapshot.balanceValue(),
                tuningSnapshot.amountAuto(),
                tuningSnapshot.amountValue(),
                tuningSnapshot.diversityAuto(),
                tuningSnapshot.diversityValue(),
                encounterTables.selectedEncounterTableIds()));
    }

    private void runWithSuppressedInput(Runnable action) {
        suppressedInputDepth++;
        try {
            action.run();
        } finally {
            suppressedInputDepth--;
        }
    }

    private static final class SectionView extends VBox {

        SectionView(String title, Node content) {
            super(0, new SectionHeader(title), content);
        }
    }

    private static final class SectionHeader extends Label {

        SectionHeader(String text) {
            super(text);
            getStyleClass().addAll(STYLE_SECTION_HEADER, STYLE_TEXT_MUTED);
        }
    }

    private static final class PaddedSection extends VBox {

        PaddedSection(Node content) {
            super(content);
            setPadding(new Insets(0, 4, 0, 4));
        }
    }

    private static final class SurfaceSection extends VBox {

        SurfaceSection(Node... children) {
            super(children);
            getStyleClass().add("surface-root");
            setPadding(new Insets(6, 8, 6, 8));
        }
    }

    private static final class ControlSeparator extends Region {

        ControlSeparator() {
            getStyleClass().add("control-separator");
        }
    }
}
