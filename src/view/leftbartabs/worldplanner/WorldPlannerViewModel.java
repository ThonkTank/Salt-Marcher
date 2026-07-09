package src.view.leftbartabs.worldplanner;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.view.slotcontent.controls.searchfilter.SearchFilterControlsContentModel;
import src.view.slotcontent.controls.searchfilter.SearchFilterControlsView;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.TooManyMethods"})
final class WorldPlannerViewModel {

    private static final String VIEW_PARAMETER = "view";

    private final WorldPlannerControlsContentModel controlsContentModel = new WorldPlannerControlsContentModel();
    private final SearchFilterControlsContentModel searchFilterContentModel = new SearchFilterControlsContentModel();
    private final WorldPlannerNpcMainContentModel npcMainContentModel = new WorldPlannerNpcMainContentModel();
    private final WorldPlannerFactionMainContentModel factionMainContentModel = new WorldPlannerFactionMainContentModel();
    private final WorldPlannerLocationMainContentModel locationMainContentModel =
            new WorldPlannerLocationMainContentModel();
    private final WorldPlannerSourceMainContentModel sourceMainContentModel = new WorldPlannerSourceMainContentModel();
    private final WorldPlannerMainContentModel mainContentModel = new WorldPlannerMainContentModel();
    private final WorldPlannerStateContentModel stateContentModel = new WorldPlannerStateContentModel();
    private final WorldPlannerContributionModel contributionModel = new WorldPlannerContributionModel(
            controlsContentModel,
            searchFilterContentModel,
            npcMainContentModel,
            factionMainContentModel,
            locationMainContentModel,
            sourceMainContentModel,
            stateContentModel);

    WorldPlannerViewModel(boolean encounterAvailable) {
        contributionModel.setEncounterAvailable(encounterAvailable);
    }

    void bindControls(WorldPlannerControlsView view) {
        Objects.requireNonNull(view, VIEW_PARAMETER).bind(controlsContentModel);
    }

    void bindSearchFilters(SearchFilterControlsView view) {
        Objects.requireNonNull(view, VIEW_PARAMETER).bind(searchFilterContentModel);
    }

    void bindNpcMain(WorldPlannerNpcMainView view) {
        Objects.requireNonNull(view, VIEW_PARAMETER).bind(npcMainContentModel);
    }

    void bindFactionMain(WorldPlannerFactionMainView view) {
        Objects.requireNonNull(view, VIEW_PARAMETER).bind(factionMainContentModel);
    }

    void bindLocationMain(WorldPlannerLocationMainView view) {
        Objects.requireNonNull(view, VIEW_PARAMETER).bind(locationMainContentModel);
    }

    void bindSourceMain(WorldPlannerSourceMainView view) {
        Objects.requireNonNull(view, VIEW_PARAMETER).bind(sourceMainContentModel);
    }

    void bindMain(WorldPlannerMainView view) {
        Objects.requireNonNull(view, VIEW_PARAMETER).bind(mainContentModel);
    }

    void bindState(WorldPlannerStateView view) {
        Objects.requireNonNull(view, VIEW_PARAMETER).bind(stateContentModel);
    }

    void onControlsInput(WorldPlannerControlsView view, Consumer<ControlsInput> sink) {
        Consumer<ControlsInput> safeSink = sink == null ? event -> { } : sink;
        Objects.requireNonNull(view, VIEW_PARAMETER).onViewInputEvent(event ->
                safeSink.accept(new ControlsInput(event.selectedModuleIndex(), event.refreshRequested())));
    }

    void activate(int moduleIndex) {
        contributionModel.activate(moduleIndex);
    }

    void applySearchFilters(String query, Map<String, List<String>> filters) {
        contributionModel.applySearchFilters(query, filters);
    }

    void selectNpc(int index) {
        contributionModel.selectNpc(index);
    }

    void selectFaction(int index) {
        contributionModel.selectFaction(index);
    }

    void selectLocation(int index) {
        contributionModel.selectLocation(index);
    }

    long selectedNpcId() {
        return contributionModel.selectedNpcId();
    }

    long npcStatblockChoiceId(int choiceIndex) {
        return contributionModel.npcStatblockChoiceId(choiceIndex);
    }

    long selectedNpcStatblockId() {
        return contributionModel.selectedNpcStatblockId();
    }

    long selectedFactionId() {
        return contributionModel.selectedFactionId();
    }

    long selectedLocationId() {
        return contributionModel.selectedLocationId();
    }

    long factionPrimaryTableChoiceId(int choiceIndex) {
        return contributionModel.factionPrimaryTableChoiceId(choiceIndex);
    }

    long factionNpcChoiceId(int choiceIndex) {
        return contributionModel.factionNpcChoiceId(choiceIndex);
    }

    long factionStatblockChoiceId(int choiceIndex) {
        return contributionModel.factionStatblockChoiceId(choiceIndex);
    }

    long locationFactionChoiceId(int choiceIndex) {
        return contributionModel.locationFactionChoiceId(choiceIndex);
    }

    long locationTableChoiceId(int choiceIndex) {
        return contributionModel.locationTableChoiceId(choiceIndex);
    }

    void applySnapshot(WorldPlannerSnapshot nextSnapshot) {
        contributionModel.applySnapshot(nextSnapshot);
    }

    void applyCreatureCatalog(CreatureCatalogPageResult result) {
        contributionModel.applyCreatureCatalog(result);
    }

    void applyEncounterTables(EncounterTableCatalogResult result) {
        contributionModel.applyEncounterTables(result);
    }

    String detailKey() {
        return contributionModel.detailKey();
    }

    String detailTitle() {
        return contributionModel.detailTitle();
    }

    WorldPlannerDetailContentModel.Projection detailProjection() {
        return contributionModel.detailProjection();
    }

    record ControlsInput(
            int selectedModuleIndex,
            boolean refreshRequested
    ) {
    }
}
