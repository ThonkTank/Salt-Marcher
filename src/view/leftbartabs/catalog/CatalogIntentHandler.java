package src.view.leftbartabs.catalog;

import java.util.Objects;
import java.util.function.Consumer;

final class CatalogIntentHandler {

    private final CatalogContributionModel presentationModel;
    private Consumer<CatalogPublishedEvent> publishedEventListener = ignored -> {};

    CatalogIntentHandler(CatalogContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<CatalogPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> {} : listener;
    }

    void consume(CatalogControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.creatureFiltersChanged()) {
            CatalogControlsViewInputEvent.FilterPayload filterState = event.filterState();
            CatalogContributionModel.CreatureFilters nextFilters = new CatalogContributionModel.CreatureFilters(
                    filterState.nameQuery(),
                    filterState.challengeRatingMin(),
                    filterState.challengeRatingMax(),
                    filterState.sizes(),
                    filterState.types(),
                    filterState.subtypes(),
                    filterState.biomes(),
                    filterState.alignments());
            presentationModel.applyCreatureFilters(nextFilters);
            presentationModel.beginSearch();
            presentationModel.advanceSearchCycle();
            publishedEventListener.accept(CatalogPublishedEvent.updateCreatureFilters(
                    nextFilters.types(),
                    nextFilters.subtypes(),
                    nextFilters.biomes()));
            return;
        }
        if (event.encounterDifficultyChanged()) {
            publishedEventListener.accept(CatalogPublishedEvent.updateEncounterDifficulty(event.difficultyKey()));
            return;
        }
        if (event.encounterTuningChanged()) {
            CatalogControlsViewInputEvent.EncounterTuning tuning = event.tuning();
            CatalogControlsViewInputEvent.EncounterTuning safeTuning =
                    tuning == null ? CatalogControlsViewInputEvent.EncounterTuning.empty() : tuning;
            publishedEventListener.accept(CatalogPublishedEvent.updateEncounterTuning(
                    safeTuning.balanceLevel(),
                    safeTuning.amountValue(),
                    safeTuning.diversityLevel()));
            return;
        }
        if (event.encounterTablesChanged()) {
            publishedEventListener.accept(CatalogPublishedEvent.updateEncounterTables(event.encounterTableIds()));
        }
    }

    void consume(CatalogMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (!event.sortKey().isBlank()) {
            presentationModel.selectSort(event.sortKey());
            presentationModel.beginSearch();
            presentationModel.advanceSearchCycle();
            return;
        }
        if (event.pageShift() < 0) {
            presentationModel.previousPage();
            presentationModel.beginSearch();
            presentationModel.advanceSearchCycle();
            return;
        }
        if (event.pageShift() > 0) {
            presentationModel.nextPage();
            presentationModel.beginSearch();
            presentationModel.advanceSearchCycle();
            return;
        }
        if (event.openedCreatureId() > 0L) {
            presentationModel.selectCreatureDetail(event.openedCreatureId());
            return;
        }
        if (event.actionCreatureId() > 0L) {
            publishedEventListener.accept(CatalogPublishedEvent.addCreature(event.actionCreatureId()));
        }
    }
}
