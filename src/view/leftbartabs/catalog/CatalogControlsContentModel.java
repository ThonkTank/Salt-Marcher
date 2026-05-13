package src.view.leftbartabs.catalog;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;

public final class CatalogControlsContentModel {

    private final ReadOnlyObjectWrapper<CatalogContributionModel.ControlsProjection> projection =
            new ReadOnlyObjectWrapper<>(CatalogContributionModel.ControlsProjection.initial());
    private CatalogContributionModel.LocalFilterState localFilters = CatalogContributionModel.LocalFilterState.empty();
    private CatalogContributionModel.ControlsState authoritativeControls = CatalogContributionModel.ControlsState.empty();
    private CatalogContributionModel.ControlsState controlsState = CatalogContributionModel.ControlsState.empty();
    private CatalogContributionModel.FilterOptionsProjection filterOptions =
            CatalogContributionModel.FilterOptionsProjection.empty();
    private CatalogContributionModel.FilterDropdownState sizeDropdownState =
            CatalogContributionModel.FilterDropdownState.closed();
    private CatalogContributionModel.FilterDropdownState typeDropdownState =
            CatalogContributionModel.FilterDropdownState.closed();
    private CatalogContributionModel.FilterDropdownState subtypeDropdownState =
            CatalogContributionModel.FilterDropdownState.closed();
    private CatalogContributionModel.FilterDropdownState biomeDropdownState =
            CatalogContributionModel.FilterDropdownState.closed();
    private CatalogContributionModel.FilterDropdownState alignmentDropdownState =
            CatalogContributionModel.FilterDropdownState.closed();
    private CatalogContributionModel.FilterDropdownState encounterTableDropdownState =
            CatalogContributionModel.FilterDropdownState.closed();
    private List<CatalogContributionModel.EncounterTableOption> encounterTableOptions = List.of();

    ReadOnlyObjectProperty<CatalogContributionModel.ControlsProjection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applyControlsDraft(CatalogContributionModel.ControlsDraft draft) {
        CatalogContributionModel.ControlsDraft safeDraft = draft == null
                ? new CatalogContributionModel.ControlsDraft(
                        CatalogContributionModel.LocalFilterState.empty(),
                        CatalogContributionModel.ControlsState.empty(),
                        CatalogContributionModel.FilterDropdownState.closed(),
                        CatalogContributionModel.FilterDropdownState.closed(),
                        CatalogContributionModel.FilterDropdownState.closed(),
                        CatalogContributionModel.FilterDropdownState.closed(),
                        CatalogContributionModel.FilterDropdownState.closed(),
                        CatalogContributionModel.FilterDropdownState.closed())
                : draft;
        localFilters = safeDraft.localFilters();
        controlsState = safeDraft.controlsState();
        sizeDropdownState = safeDraft.sizeDropdownState();
        typeDropdownState = safeDraft.typeDropdownState();
        subtypeDropdownState = safeDraft.subtypeDropdownState();
        biomeDropdownState = safeDraft.biomeDropdownState();
        alignmentDropdownState = safeDraft.alignmentDropdownState();
        encounterTableDropdownState = safeDraft.encounterTableDropdownState();
        refreshProjection();
    }

    void applyCreatureFilterOptions(CreatureFilterOptionsResult result) {
        CreatureFilterOptions options = result == null || result.options() == null
                ? CreatureFilterOptions.empty()
                : result.options();
        filterOptions = new CatalogContributionModel.FilterOptionsProjection(
                options.sizes(),
                options.types(),
                options.subtypes(),
                options.biomes(),
                options.alignments(),
                options.challengeRatings());
        localFilters = localFilters.retainAvailable(filterOptions);
        refreshProjection();
    }

    boolean applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
        CatalogContributionModel.ControlsState previousAuthoritative = authoritativeControls;
        CatalogContributionModel.ControlsState next =
                CatalogContributionModel.ControlsState.fromBuilderInputs(builderInputs, previousAuthoritative);
        authoritativeControls = next;
        controlsState = next;
        refreshProjection();
        return CatalogContributionModel.ControlsState.searchControlsChanged(previousAuthoritative, next);
    }

    void applyEncounterTables(EncounterTableCatalogResult result) {
        if (result == null || result.status() != EncounterTableReadStatus.SUCCESS) {
            encounterTableOptions = List.of();
            refreshProjection();
            return;
        }
        encounterTableOptions = result.tables().stream()
                .map(CatalogContributionModel.EncounterTableOption::fromSummary)
                .toList();
        refreshProjection();
    }

    void applyEncounterTuningPreview(EncounterTuningPreviewLabels labels) {
        authoritativeControls = authoritativeControls.withPreviewLabels(labels);
        controlsState = controlsState.withPreviewLabels(labels);
        refreshProjection();
    }

    CatalogContributionModel.InteractionState interactionState() {
        return new CatalogContributionModel.InteractionState(localFilters, controlsState, authoritativeControls);
    }

    CatalogContributionModel.CreatureFilters currentSearchFilters() {
        return mergedFilters(localFilters, authoritativeControls);
    }

    private void refreshProjection() {
        CatalogContributionModel.CreatureFilters creatureFilters = mergedFilters(localFilters, controlsState);
        projection.set(new CatalogContributionModel.ControlsProjection(
                filterOptions,
                creatureFilters,
                sizeDropdownState,
                typeDropdownState,
                subtypeDropdownState,
                biomeDropdownState,
                alignmentDropdownState,
                encounterTableDropdownState,
                encounterTableOptions,
                CatalogContributionModel.FilterChip.from(creatureFilters, encounterTableOptions, controlsState),
                controlsState));
    }

    private static CatalogContributionModel.CreatureFilters mergedFilters(
            CatalogContributionModel.LocalFilterState local,
            CatalogContributionModel.ControlsState controls
    ) {
        CatalogContributionModel.LocalFilterState safeLocal = local == null
                ? CatalogContributionModel.LocalFilterState.empty()
                : local;
        CatalogContributionModel.ControlsState safeControls = controls == null
                ? CatalogContributionModel.ControlsState.empty()
                : controls;
        return new CatalogContributionModel.CreatureFilters(
                safeLocal.nameQuery(),
                safeLocal.challengeRatingMin(),
                safeLocal.challengeRatingMax(),
                safeLocal.sizes(),
                safeControls.creatureTypes(),
                safeControls.creatureSubtypes(),
                safeControls.biomes(),
                safeLocal.alignments());
    }
}
