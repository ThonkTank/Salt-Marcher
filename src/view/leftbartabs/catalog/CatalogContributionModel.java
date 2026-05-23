package src.view.leftbartabs.catalog;

import java.util.List;
import javafx.beans.property.ReadOnlyLongProperty;
import javafx.beans.property.ReadOnlyLongWrapper;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encountertable.published.EncounterTableCatalogResult;

public final class CatalogContributionModel {

    private final CatalogMainContentModel mainContentModel = new CatalogMainContentModel();
    private final CatalogControlsContentModel controlsContentModel = new CatalogControlsContentModel();
    private final ReadOnlyLongWrapper creatureDetailSelection = new ReadOnlyLongWrapper(0L);

    CatalogMainContentModel mainContentModel() {
        return mainContentModel;
    }

    CatalogControlsContentModel controlsContentModel() {
        return controlsContentModel;
    }

    ReadOnlyLongProperty creatureDetailSelectionProperty() {
        return creatureDetailSelection.getReadOnlyProperty();
    }

    void applyControlsDraft(CatalogControlsContentModel.ControlsDraft draft) {
        controlsContentModel.applyControlsDraft(draft);
    }

    void applyCreatureFilterOptions(CreatureFilterOptionsResult result) {
        controlsContentModel.applyCreatureFilterOptions(result);
    }

    boolean applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
        return controlsContentModel.applyEncounterBuilderInputs(builderInputs);
    }

    void applyEncounterTables(EncounterTableCatalogResult result) {
        controlsContentModel.applyEncounterTables(result);
    }

    void applyEncounterTuningPreview(EncounterTuningPreviewLabels labels) {
        controlsContentModel.applyEncounterTuningPreview(labels);
    }

    void selectSort(String sortKey) {
        mainContentModel.selectSort(sortKey);
    }

    void shiftPage(int pageShift) {
        mainContentModel.shiftPage(pageShift);
    }

    void applySearchResult(CreatureCatalogPageResult result) {
        mainContentModel.applySearchResult(result);
    }

    void beginSearch() {
        mainContentModel.beginSearch();
    }

    void setCreatureDetailSelection(long creatureId) {
        creatureDetailSelection.set(Math.max(0L, creatureId));
    }

    CatalogControlsContentModel.InteractionState currentInteractionState() {
        return controlsContentModel.interactionState();
    }

    String currentNameQuery() {
        return controlsContentModel.currentSearchFilters().nameQuery();
    }

    String currentChallengeRatingMin() {
        return controlsContentModel.currentSearchFilters().challengeRatingMin();
    }

    String currentChallengeRatingMax() {
        return controlsContentModel.currentSearchFilters().challengeRatingMax();
    }

    List<String> currentSizes() {
        return controlsContentModel.currentSearchFilters().sizes();
    }

    List<String> currentCreatureTypes() {
        return controlsContentModel.currentSearchFilters().types();
    }

    List<String> currentCreatureSubtypes() {
        return controlsContentModel.currentSearchFilters().subtypes();
    }

    List<String> currentBiomes() {
        return controlsContentModel.currentSearchFilters().biomes();
    }

    List<String> currentAlignments() {
        return controlsContentModel.currentSearchFilters().alignments();
    }

    String currentSortKey() {
        return mainContentModel.currentSortKey();
    }

    int currentPageOffset() {
        return mainContentModel.currentPageOffset();
    }
}
