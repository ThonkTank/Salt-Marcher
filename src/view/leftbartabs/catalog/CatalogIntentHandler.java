package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.Objects;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.RefreshCreatureCatalogCommand;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;

final class CatalogIntentHandler {

    private static final long NO_CREATURE_ID = 0L;
    private static final int MIN_DIFFICULTY_LEVEL = 1;
    private static final int DEFAULT_DIFFICULTY_LEVEL = 2;
    private static final int NEUTRAL_DIFFICULTY_LEVEL = 3;
    private static final int MAX_DIFFICULTY_LEVEL = 4;

    private final CatalogContributionModel presentationModel;
    private final CreaturesApplicationService creatures;
    private final EncounterApplicationService encounters;

    CatalogIntentHandler(
            CatalogContributionModel presentationModel,
            CreaturesApplicationService creatures,
            EncounterApplicationService encounters
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
    }

    void consume(CatalogControlsViewInputEvent event) {
        if (event == null) {
            return;
        }

        CatalogContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        CatalogContributionModel.LocalFilterState previousLocalFilters = interactionState.localFilters();
        CatalogContributionModel.ControlsState previousDraftControls = interactionState.draftControls();
        CatalogContributionModel.ControlsState authoritativeControls = interactionState.domainControls();

        presentationModel.applyControlsDraft(new CatalogContributionModel.ControlsDraft(
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
                        CatalogContributionModel.SliderProjection.draftDifficulty(
                                event.difficultyAuto(),
                                event.difficultyValue(),
                                previousDraftControls.difficulty()),
                        CatalogContributionModel.SliderProjection.draftBalance(
                                event.balanceAuto(),
                                event.balanceValue(),
                                previousDraftControls.balance()),
                        CatalogContributionModel.SliderProjection.draftAmount(
                                event.amountAuto(),
                                event.amountValue(),
                                previousDraftControls.amount()),
                        CatalogContributionModel.SliderProjection.draftDiversity(
                                event.diversityAuto(),
                                event.diversityValue(),
                                previousDraftControls.diversity())),
                new CatalogContributionModel.FilterDropdownState(event.sizePopupOpen(), event.sizePopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.typePopupOpen(), event.typePopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.subtypePopupOpen(), event.subtypePopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.biomePopupOpen(), event.biomePopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.alignmentPopupOpen(), event.alignmentPopupQuery()),
                new CatalogContributionModel.FilterDropdownState(event.encounterTablePopupOpen(), "")));

        CatalogContributionModel.InteractionState currentState = presentationModel.currentInteractionState();
        if (!previousLocalFilters.equals(currentState.localFilters())) {
            refreshSearch();
        }

        CatalogContributionModel.ControlsState currentDraftControls = currentState.draftControls();
        if (!previousDraftControls.equals(currentDraftControls) && !currentDraftControls.equals(authoritativeControls)) {
            encounters.updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(
                    new EncounterBuilderInputs(
                            currentDraftControls.creatureTypes(),
                            currentDraftControls.creatureSubtypes(),
                            currentDraftControls.biomes(),
                            currentDraftControls.difficulty().auto(),
                            toDifficultyLevel(currentDraftControls.difficulty().value()),
                            currentDraftControls.balance().auto(),
                            toBalanceLevel(currentDraftControls.balance().value()),
                            currentDraftControls.amount().auto(),
                            currentDraftControls.amount().value(),
                            currentDraftControls.diversity().auto(),
                            toDiversityLevel(currentDraftControls.diversity().value()),
                            currentDraftControls.encounterTableIds())));
        }
    }

    void consume(CatalogMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (!event.sortKey().isBlank()) {
            presentationModel.selectSort(event.sortKey());
            refreshSearch();
            return;
        }
        if (event.pageShift() != 0) {
            presentationModel.shiftPage(event.pageShift());
            refreshSearch();
            return;
        }
        if (event.openedCreatureId() > NO_CREATURE_ID) {
            presentationModel.setCreatureDetailSelection(event.openedCreatureId());
            return;
        }
        if (event.actionCreatureId() > NO_CREATURE_ID) {
            encounters.applyState(new ApplyEncounterStateCommand(
                    ApplyEncounterStateCommand.Action.ADD_CREATURE,
                    event.actionCreatureId(),
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false));
        }
    }

    private void refreshSearch() {
        presentationModel.beginSearch();
        CatalogContributionModel.SearchRequest request = presentationModel.currentSearchRequest();
        creatures.refreshCatalog(new RefreshCreatureCatalogCommand(
                request.nameQuery(),
                request.challengeRatingMin(),
                request.challengeRatingMax(),
                request.sizes(),
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                request.alignments(),
                request.sortField(),
                request.sortDirection(),
                50,
                request.pageOffset()));
    }

    private static int toDifficultyLevel(double value) {
        int rounded = (int) Math.round(value);
        if (rounded <= MIN_DIFFICULTY_LEVEL) {
            return MIN_DIFFICULTY_LEVEL;
        }
        if (rounded == NEUTRAL_DIFFICULTY_LEVEL) {
            return NEUTRAL_DIFFICULTY_LEVEL;
        }
        if (rounded >= MAX_DIFFICULTY_LEVEL) {
            return MAX_DIFFICULTY_LEVEL;
        }
        return DEFAULT_DIFFICULTY_LEVEL;
    }

    private static int toBalanceLevel(double value) {
        return (int) Math.round(value);
    }

    private static int toDiversityLevel(double value) {
        return (int) Math.round(value);
    }
}
