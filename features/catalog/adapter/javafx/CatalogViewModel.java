package features.catalog.adapter.javafx;

import java.util.Objects;
import features.catalog.application.CatalogApplicationRoutes.CreatureInspectorRoute;
import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.SceneHandoff;
import features.catalog.application.CatalogRequestToken;
import features.catalog.application.CatalogWorkspaceController;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureCatalogQuery;
import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureFilterOptions;
import features.creatures.api.CreatureFilterOptionsResult;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReadStatus;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.EncounterPoolFilters;

final class CatalogViewModel {

    private static final long NO_CREATURE_ID = 0L;

    private final CatalogMainContentModel mainContentModel = new CatalogMainContentModel();
    private final CatalogControlsContentModel controlsContentModel = new CatalogControlsContentModel();
    private final CreatureCatalogQueryApi creatureQueries;
    private final CreatureInspectorRoute creatureInspector;
    private final EncounterHandoff encounter;
    private final SceneHandoff scene;
    private final CatalogWorkspaceController controller;

    CatalogViewModel(
            CreatureCatalogQueryApi creatureQueries,
            CreatureInspectorRoute creatureInspector,
            EncounterHandoff encounter,
            SceneHandoff scene,
            CatalogWorkspaceController controller
    ) {
        this.creatureQueries = Objects.requireNonNull(creatureQueries, "creatureQueries");
        this.creatureInspector = Objects.requireNonNull(creatureInspector, "creatureInspector");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
        this.scene = Objects.requireNonNull(scene, "scene");
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    void initialize() {
        loadFilterOptions();
        refreshCatalog();
    }

    CatalogMainContentModel mainContentModel() {
        return mainContentModel;
    }

    CatalogControlsContentModel controlsContentModel() {
        return controlsContentModel;
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
                        event.worldLocationId()),
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
            encounter.updatePoolFilters(new EncounterPoolFilters(
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
                    currentDraftControls.worldLocationId()));
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
            creatureInspector.openCreature(event.openedCreatureId());
            return;
        }
        if (event.actionCreatureId() > NO_CREATURE_ID) {
            encounter.addCreature(event.actionCreatureId());
            return;
        }
        if (event.sceneCreatureId() > NO_CREATURE_ID) {
            scene.addCreature(event.sceneCreatureId());
        }
    }

    void applyEncounterBuilderInputs(EncounterBuilderInputs builderInputs) {
        if (controlsContentModel.applyEncounterBuilderInputs(builderInputs)) {
            refreshCatalog();
        }
    }

    private void refreshCatalog() {
        CatalogControlsContentModel.CreatureFilters searchFilters = controlsContentModel.currentSearchFilters();
        CatalogRequestToken request = controller.beginMonsterSearch();
        creatureQueries.search(new CreatureCatalogQuery(
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
                mainContentModel.currentPageOffset())).whenComplete((result, failure) -> controller.complete(request, () -> {
                    controller.monsterSearchCompleted(result, failure);
                    mainContentModel.applySearchResult(failure == null && result != null
                            ? result
                            : new CreatureCatalogPageResult(
                                    CreatureQueryStatus.STORAGE_ERROR,
                                    CreatureCatalogPage.empty(50, mainContentModel.currentPageOffset())));
                }));
    }

    private void loadFilterOptions() {
        CatalogRequestToken request = controller.beginMonsterFilterOptions();
        creatureQueries.loadFilterOptions().whenComplete((result, failure) -> controller.complete(request, () -> {
            controller.monsterFilterOptionsCompleted(result, failure);
            controlsContentModel.applyCreatureFilterOptions(failure == null && result != null
                    ? result
                    : new CreatureFilterOptionsResult(CreatureReadStatus.STORAGE_ERROR, CreatureFilterOptions.empty()));
        }));
    }

}
