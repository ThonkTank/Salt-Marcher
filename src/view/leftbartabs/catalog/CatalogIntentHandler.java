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
        if (event.kind() == CatalogControlsViewInputEvent.Kind.FILTERS_CHANGED) {
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
            publishedEventListener.accept(CatalogPublishedEvent.updateCreatureFilters(
                    nextFilters.types(),
                    nextFilters.subtypes(),
                    nextFilters.biomes()));
            presentationModel.beginSearch();
            presentationModel.requestSearch();
            return;
        }
        if (event.kind() == CatalogControlsViewInputEvent.Kind.ENCOUNTER_DIFFICULTY_CHANGED) {
            publishedEventListener.accept(CatalogPublishedEvent.updateEncounterDifficulty(event.difficultyKey()));
            return;
        }
        if (event.kind() == CatalogControlsViewInputEvent.Kind.ENCOUNTER_TUNING_CHANGED) {
            CatalogControlsViewInputEvent.EncounterTuning tuning = event.tuning();
            CatalogControlsViewInputEvent.EncounterTuning safeTuning =
                    tuning == null ? CatalogControlsViewInputEvent.EncounterTuning.empty() : tuning;
            publishedEventListener.accept(CatalogPublishedEvent.updateEncounterTuning(
                    safeTuning.balanceLevel(),
                    safeTuning.amountValue(),
                    safeTuning.diversityLevel()));
            return;
        }
        if (event.kind() == CatalogControlsViewInputEvent.Kind.ENCOUNTER_TABLES_CHANGED) {
            publishedEventListener.accept(CatalogPublishedEvent.updateEncounterTables(event.encounterTableIds()));
        }
    }

    void consume(CatalogMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case SORT_CHANGED -> {
                presentationModel.selectSort(event.sortKey());
                presentationModel.beginSearch();
                presentationModel.requestSearch();
            }
            case PREVIOUS_PAGE -> {
                presentationModel.previousPage();
                presentationModel.beginSearch();
                presentationModel.requestSearch();
            }
            case NEXT_PAGE -> {
                presentationModel.nextPage();
                presentationModel.beginSearch();
                presentationModel.requestSearch();
            }
            case ROW_OPENED -> presentationModel.requestOpenCreatureDetails(event.creatureId());
            case ROW_ACTION_TRIGGERED -> publishedEventListener.accept(CatalogPublishedEvent.addCreature(event.creatureId()));
        }
    }
}
