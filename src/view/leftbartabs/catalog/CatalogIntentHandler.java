package src.view.leftbartabs.catalog;

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
    private final CatalogControlsContentModel controlsModel;
    private final CatalogMainContentModel mainModel;
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
        controlsModel = presentationModel.controlsContentModel();
        mainModel = presentationModel.mainContentModel();
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        refreshCatalogSources();
    }

    void consume(CatalogControlsViewInputEvent event) {
        if (event == null) {
            return;
        }

        CatalogControlsContentModel.InteractionState interactionState = controlsModel.interactionState();
        CatalogControlsContentModel.LocalFilterState previousLocalFilters = interactionState.localFilters();
        CatalogControlsContentModel.ControlsState previousDraftControls = interactionState.draftControls();
        CatalogControlsContentModel.ControlsState authoritativeControls = interactionState.domainControls();

        controlsModel.applyControlsDraft(new CatalogControlsContentModel.ControlsDraft(
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
                        event.worldFactionIds(),
                        event.worldLocationId(),
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

        CatalogControlsContentModel.InteractionState currentState = controlsModel.interactionState();
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
                            roundedLevel(currentDraftControls.balance().value()),
                            currentDraftControls.amount().auto(),
                            currentDraftControls.amount().value(),
                            currentDraftControls.diversity().auto(),
                            roundedLevel(currentDraftControls.diversity().value()),
                            currentDraftControls.encounterTableIds(),
                            currentDraftControls.worldFactionIds(),
                            currentDraftControls.worldLocationId())));
        }
    }

    void consume(CatalogMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (!event.sortKey().isBlank()) {
            mainModel.selectSort(event.sortKey());
            refreshSearch();
            return;
        }
        if (event.pageShift() != 0) {
            mainModel.shiftPage(event.pageShift());
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
        mainModel.beginSearch();
        refreshCatalog();
    }

    void applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
        if (controlsModel.applyEncounterBuilderInputs(builderInputs)) {
            refreshCatalog();
        }
    }

    private void refreshCatalog() {
        CatalogControlsContentModel.CreatureFilters searchFilters = controlsModel.currentSearchFilters();
        creatures.refreshCatalog(new RefreshCreatureCatalogCommand(
                searchFilters.nameQuery(),
                searchFilters.challengeRatingMin(),
                searchFilters.challengeRatingMax(),
                searchFilters.sizes(),
                searchFilters.types(),
                searchFilters.subtypes(),
                searchFilters.biomes(),
                searchFilters.alignments(),
                mainModel.currentSortFieldName(),
                mainModel.currentSortDirectionName(),
                50,
                mainModel.currentPageOffset()));
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
        encounters.applyState(ApplyEncounterStateCommand.addCreature(creatureId));
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

    private static int roundedLevel(double value) {
        return (int) Math.round(value);
    }
}
