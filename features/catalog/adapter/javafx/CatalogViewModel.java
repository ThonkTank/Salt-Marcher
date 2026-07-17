package features.catalog.adapter.javafx;

import java.util.Objects;
import javafx.beans.property.ReadOnlyLongProperty;
import javafx.beans.property.ReadOnlyLongWrapper;
import features.creatures.api.CreaturesApi;
import features.creatures.api.RefreshCreatureCatalogCommand;
import features.creatures.api.RefreshCreatureFilterOptionsCommand;
import features.creatures.api.SelectCreatureDetailCommand;
import features.encounter.api.EncounterApi;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.RefreshEncounterTableCatalogCommand;

final class CatalogViewModel {

    private static final long NO_CREATURE_ID = 0L;

    private final CatalogMainContentModel mainContentModel = new CatalogMainContentModel();
    private final CatalogControlsContentModel controlsContentModel = new CatalogControlsContentModel();
    private final ReadOnlyLongWrapper creatureDetailSelection = new ReadOnlyLongWrapper(0L);
    private final CreaturesApi creatures;
    private final EncounterTableApi encounterTables;
    private final EncounterApi encounters;
    private final java.util.function.LongConsumer addCreatureToScene;

    CatalogViewModel(
            CreaturesApi creatures,
            EncounterTableApi encounterTables,
            EncounterApi encounters
    ) {
        this(creatures, encounterTables, encounters, ignored -> { });
    }

    CatalogViewModel(
            CreaturesApi creatures,
            EncounterTableApi encounterTables,
            EncounterApi encounters,
            java.util.function.LongConsumer addCreatureToScene
    ) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.addCreatureToScene = Objects.requireNonNull(addCreatureToScene, "addCreatureToScene");
        creatures.refreshFilterOptions(new RefreshCreatureFilterOptionsCommand());
        encounterTables.refreshCatalog(new RefreshEncounterTableCatalogCommand());
        refreshCatalog();
    }

    CatalogMainContentModel mainContentModel() {
        return mainContentModel;
    }

    CatalogControlsContentModel controlsContentModel() {
        return controlsContentModel;
    }

    ReadOnlyLongProperty creatureDetailSelectionProperty() {
        return creatureDetailSelection.getReadOnlyProperty();
    }

    void setCreatureDetailSelection(long creatureId) {
        creatureDetailSelection.set(Math.max(0L, creatureId));
    }

    void consume(CatalogControlsViewInputEvent event) {
        if (event == null) {
            return;
        }

        CatalogControlsContentModel.InteractionState interactionState = controlsContentModel.interactionState();
        CatalogControlsContentModel.LocalFilterState previousLocalFilters = interactionState.localFilters();
        CatalogControlsContentModel.ControlsState previousDraftControls = interactionState.draftControls();

        controlsContentModel.applyControlsDraft(new CatalogControlsContentModel.ControlsDraft(
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

        CatalogControlsContentModel.InteractionState currentState = controlsContentModel.interactionState();
        if (!previousLocalFilters.equals(currentState.localFilters())) {
            mainContentModel.beginSearch();
            refreshCatalog();
        }

        CatalogControlsContentModel.ControlsState currentDraftControls = currentState.draftControls();
        boolean poolFiltersChanged = !previousLocalFilters.equals(currentState.localFilters())
                || !previousDraftControls.equals(currentDraftControls);
        if (poolFiltersChanged) {
            CatalogControlsContentModel.LocalFilterState filters = currentState.localFilters();
            encounters.updatePoolFilters(new UpdateEncounterPoolFiltersCommand(new EncounterPoolFilters(
                    filters.nameQuery(),
                    filters.challengeRatingMin(),
                    filters.challengeRatingMax(),
                    filters.sizes(),
                    currentDraftControls.creatureTypes(),
                    currentDraftControls.creatureSubtypes(),
                    currentDraftControls.biomes(),
                    filters.alignments(),
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
            mainContentModel.selectSort(event.sortKey());
            mainContentModel.beginSearch();
            refreshCatalog();
            return;
        }
        if (event.pageShift() != 0) {
            mainContentModel.shiftPage(event.pageShift());
            mainContentModel.beginSearch();
            refreshCatalog();
            return;
        }
        if (event.openedCreatureId() > NO_CREATURE_ID) {
            creatures.selectCreatureDetail(new SelectCreatureDetailCommand(event.openedCreatureId()));
            setCreatureDetailSelection(event.openedCreatureId());
            return;
        }
        if (event.actionCreatureId() > NO_CREATURE_ID) {
            encounters.applyState(ApplyEncounterStateCommand.addCreature(event.actionCreatureId()));
            return;
        }
        if (event.sceneCreatureId() > NO_CREATURE_ID) {
            addCreatureToScene.accept(event.sceneCreatureId());
        }
    }

    void applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
        if (controlsContentModel.applyEncounterBuilderInputs(builderInputs)) {
            refreshCatalog();
        }
    }

    private void refreshCatalog() {
        CatalogControlsContentModel.CreatureFilters searchFilters = controlsContentModel.currentSearchFilters();
        creatures.refreshCatalog(new RefreshCreatureCatalogCommand(
                searchFilters.nameQuery(),
                searchFilters.challengeRatingMin(),
                searchFilters.challengeRatingMax(),
                searchFilters.sizes(),
                searchFilters.types(),
                searchFilters.subtypes(),
                searchFilters.biomes(),
                searchFilters.alignments(),
                mainContentModel.currentSortFieldName(),
                mainContentModel.currentSortDirectionName(),
                50,
                mainContentModel.currentPageOffset()));
    }

}
