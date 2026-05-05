package src.view.leftbartabs.catalog;

import java.util.Objects;
import java.util.function.Consumer;

final class CatalogIntentHandler {

    private final CatalogContributionModel presentationModel;
    private Consumer<CatalogPublishedEvent> publishedEventListener = ignored -> { };

    CatalogIntentHandler(CatalogContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<CatalogPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> { } : listener;
    }

    void consume(CatalogControlsViewInputEvent event) {
        if (event == null) {
            return;
        }

        CatalogContributionModel.CreatureFilters previousFilters = presentationModel.currentFilters();
        CatalogContributionModel.EncounterBuilderInputsViewState previousBuilderInputs =
                presentationModel.currentEncounterBuilderInputs();

        presentationModel.applyControlsSnapshot(event);

        if (!previousFilters.equals(presentationModel.currentFilters())) {
            presentationModel.beginSearch();
            presentationModel.advanceSearchCycle();
        }

        CatalogContributionModel.EncounterBuilderInputsViewState currentBuilderInputs =
                presentationModel.currentEncounterBuilderInputs();
        if (!previousBuilderInputs.equals(currentBuilderInputs)) {
            publishedEventListener.accept(CatalogPublishedEvent.updateBuilderInputs(
                    currentBuilderInputs.creatureTypes(),
                    currentBuilderInputs.creatureSubtypes(),
                    currentBuilderInputs.biomes(),
                    currentBuilderInputs.difficultyKey(),
                    currentBuilderInputs.balanceLevel(),
                    currentBuilderInputs.amountValue(),
                    currentBuilderInputs.diversityLevel(),
                    currentBuilderInputs.encounterTableIds()));
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
