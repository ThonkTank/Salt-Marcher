package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.Objects;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.RefreshCreatureCatalogCommand;
import src.domain.creatures.published.RefreshCreatureFilterOptionsCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;

final class CatalogIntentHandler {

    private static final long NO_CREATURE_ID = 0L;
    private static final int MIN_DIFFICULTY_LEVEL = 1;
    private static final int DEFAULT_DIFFICULTY_LEVEL = 2;
    private static final int NEUTRAL_DIFFICULTY_LEVEL = 3;
    private static final int MAX_DIFFICULTY_LEVEL = 4;

    private final CatalogContributionModel presentationModel;
    private final CreaturesApplicationService creatures;
    private final EncounterTableApplicationService encounterTables;
    private final EncounterApplicationService encounters;

    CatalogIntentHandler(
            CatalogContributionModel presentationModel,
            CreaturesApplicationService creatures,
            EncounterTableApplicationService encounterTables,
            EncounterApplicationService encounters
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        refreshCatalogSources();
    }

    void consume(CatalogControlsViewInputEvent event) {
        if (event == null) {
            return;
        }

        CatalogControlsContentModel.InteractionState interactionState = presentationModel.currentInteractionState();
        CatalogControlsContentModel.LocalFilterState previousLocalFilters = interactionState.localFilters();
        CatalogControlsContentModel.ControlsState previousDraftControls = interactionState.draftControls();
        CatalogControlsContentModel.ControlsState authoritativeControls = interactionState.domainControls();

        presentationModel.applyControlsDraft(new CatalogControlsContentModel.ControlsDraft(
                new CatalogControlsContentModel.LocalFilterState(
                        event.nameQuery(),
                        event.challengeRatingMin(),
                        event.challengeRatingMax(),
                        event.sizes(),
                        event.alignments()),
                new CatalogControlsContentModel.ControlsState(
                        event.types(),
                        event.subtypes(),
                        event.biomes(),
                        event.encounterTableIds(),
                        CatalogControlsContentModel.SliderProjection.draftDifficulty(
                                event.difficultyAuto(),
                                event.difficultyValue(),
                                previousDraftControls.difficulty()),
                        CatalogControlsContentModel.SliderProjection.draftBalance(
                                event.balanceAuto(),
                                event.balanceValue(),
                                previousDraftControls.balance()),
                        CatalogControlsContentModel.SliderProjection.draftAmount(
                                event.amountAuto(),
                                event.amountValue(),
                                previousDraftControls.amount()),
                        CatalogControlsContentModel.SliderProjection.draftDiversity(
                                event.diversityAuto(),
                                event.diversityValue(),
                                previousDraftControls.diversity())),
                new CatalogControlsContentModel.FilterDropdownState(event.sizePopupOpen(), event.sizePopupQuery()),
                new CatalogControlsContentModel.FilterDropdownState(event.typePopupOpen(), event.typePopupQuery()),
                new CatalogControlsContentModel.FilterDropdownState(event.subtypePopupOpen(), event.subtypePopupQuery()),
                new CatalogControlsContentModel.FilterDropdownState(event.biomePopupOpen(), event.biomePopupQuery()),
                new CatalogControlsContentModel.FilterDropdownState(event.alignmentPopupOpen(), event.alignmentPopupQuery()),
                new CatalogControlsContentModel.FilterDropdownState(event.encounterTablePopupOpen(), "")));

        CatalogControlsContentModel.InteractionState currentState = presentationModel.currentInteractionState();
        if (!previousLocalFilters.equals(currentState.localFilters())) {
            refreshSearch();
        }

        CatalogControlsContentModel.ControlsState currentDraftControls = currentState.draftControls();
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
            openCreatureDetail(event.openedCreatureId());
            return;
        }
        if (event.actionCreatureId() > NO_CREATURE_ID) {
            addCreatureToEncounter(event.actionCreatureId());
        }
    }

    private void refreshSearch() {
        presentationModel.beginSearch();
        refreshCatalog();
    }

    void applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
        if (presentationModel.applyEncounterBuilderInputs(builderInputs)) {
            refreshCatalog();
        }
    }

    private void refreshCatalog() {
        creatures.refreshCatalog(RefreshCreatureCatalogCommand.fromSortKey(
                presentationModel.currentNameQuery(),
                presentationModel.currentChallengeRatingMin(),
                presentationModel.currentChallengeRatingMax(),
                presentationModel.currentSizes(),
                presentationModel.currentCreatureTypes(),
                presentationModel.currentCreatureSubtypes(),
                presentationModel.currentBiomes(),
                presentationModel.currentAlignments(),
                presentationModel.currentSortKey(),
                50,
                presentationModel.currentPageOffset()));
    }

    private void refreshCatalogSources() {
        creatures.refreshFilterOptions(new RefreshCreatureFilterOptionsCommand());
        encounterTables.refreshCatalog(new RefreshEncounterTableCatalogCommand());
        refreshCatalog();
    }

    private void openCreatureDetail(long creatureId) {
        creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureId));
        presentationModel.setCreatureDetailSelection(creatureId);
    }

    private void addCreatureToEncounter(long creatureId) {
        encounters.applyState(ApplyEncounterStateCommand.creature("ADD_CREATURE", creatureId));
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
