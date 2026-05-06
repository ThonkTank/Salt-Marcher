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

        CatalogContributionModel.LocalFilterState previousLocalFilters = presentationModel.currentLocalFilters();
        CatalogContributionModel.ControlsState previousDraftControls = presentationModel.currentControlsState();
        CatalogContributionModel.ControlsState authoritativeControls = presentationModel.currentDomainControls();

        presentationModel.applyControlsDraft(
                new CatalogContributionModel.LocalFilterState(
                        event.nameQuery(),
                        event.challengeRatingMin(),
                        event.challengeRatingMax(),
                        event.sizes(),
                        event.alignments()),
                new CatalogContributionModel.ControlsState(
                        event.types(),
                        event.subtypes(),
                        event.biomes(),
                        event.encounterTableIds(),
                        CatalogContributionModel.draftDifficulty(
                                event.difficultyAuto(),
                                event.difficultyValue(),
                                previousDraftControls.difficulty()),
                        CatalogContributionModel.draftBalance(
                                event.balanceAuto(),
                                event.balanceValue(),
                                previousDraftControls.balance()),
                        CatalogContributionModel.draftAmount(
                                event.amountAuto(),
                                event.amountValue(),
                                previousDraftControls.amount()),
                        CatalogContributionModel.draftDiversity(
                                event.diversityAuto(),
                                event.diversityValue(),
                                previousDraftControls.diversity())),
                new CatalogContributionModel.FilterDropdownState(event.sizePopupOpen(), event.sizePopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.typePopupOpen(), event.typePopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.subtypePopupOpen(), event.subtypePopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.biomePopupOpen(), event.biomePopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.alignmentPopupOpen(), event.alignmentPopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.encounterTablePopupOpen(), ""));

        if (!previousLocalFilters.equals(presentationModel.currentLocalFilters())) {
            presentationModel.beginSearch();
            presentationModel.advanceSearchCycle();
        }

        CatalogContributionModel.ControlsState currentDraftControls = presentationModel.currentControlsState();
        if (!previousDraftControls.equals(currentDraftControls) && !currentDraftControls.equals(authoritativeControls)) {
            publishedEventListener.accept(CatalogPublishedEvent.updateBuilderInputs(
                    currentDraftControls.creatureTypes(),
                    currentDraftControls.creatureSubtypes(),
                    currentDraftControls.biomes(),
                    currentDraftControls.difficulty().auto(),
                    currentDraftControls.difficulty().value(),
                    currentDraftControls.balance().auto(),
                    currentDraftControls.balance().value(),
                    currentDraftControls.amount().auto(),
                    currentDraftControls.amount().value(),
                    currentDraftControls.diversity().auto(),
                    currentDraftControls.diversity().value(),
                    currentDraftControls.encounterTableIds()));
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
