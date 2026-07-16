package features.creatures.application;

import features.creatures.api.CreatureCatalogModel;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureDetailModel;
import features.creatures.api.CreatureDetailResult;
import features.creatures.api.CreatureEncounterCandidatesModel;
import features.creatures.api.CreatureEncounterCandidatesResult;
import features.creatures.api.CreatureFilterOptions;
import features.creatures.api.CreatureFilterOptionsModel;
import features.creatures.api.CreatureFilterOptionsResult;
import features.creatures.api.CreatureLookupStatus;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReadStatus;
import java.util.List;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class CreaturesPublishedState {

    private final PublishedState<CreatureFilterOptionsResult> filterOptions;
    private final PublishedState<CreatureCatalogPageResult> catalog;
    private final PublishedState<CreatureDetailResult> detail;
    private final PublishedState<CreatureEncounterCandidatesResult> encounterCandidates;
    private final CreatureFilterOptionsModel filterOptionsModel;
    private final CreatureCatalogModel catalogModel;
    private final CreatureDetailModel detailModel;
    private final CreatureEncounterCandidatesModel encounterCandidatesModel;

    public CreaturesPublishedState(UiDispatcher dispatcher) {
        filterOptions = new PublishedState<>(
                new CreatureFilterOptionsResult(CreatureReadStatus.STORAGE_ERROR, CreatureFilterOptions.empty()),
                dispatcher);
        catalog = new PublishedState<>(
                new CreatureCatalogPageResult(CreatureQueryStatus.STORAGE_ERROR, CreatureCatalogPage.empty(50, 0)),
                dispatcher);
        detail = new PublishedState<>(
                new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null),
                dispatcher);
        encounterCandidates = new PublishedState<>(
                new CreatureEncounterCandidatesResult(CreatureQueryStatus.STORAGE_ERROR, List.of()),
                dispatcher);
        filterOptionsModel = new CreatureFilterOptionsModel(filterOptions::current, filterOptions::subscribe);
        catalogModel = new CreatureCatalogModel(catalog::current, catalog::subscribe);
        detailModel = new CreatureDetailModel(detail::current, detail::subscribe);
        encounterCandidatesModel = new CreatureEncounterCandidatesModel(
                encounterCandidates::current, encounterCandidates::subscribe);
    }

    public CreatureFilterOptionsModel filterOptionsModel() {
        return filterOptionsModel;
    }

    public CreatureCatalogModel catalogModel() {
        return catalogModel;
    }

    public CreatureDetailModel detailModel() {
        return detailModel;
    }

    public CreatureEncounterCandidatesModel encounterCandidatesModel() {
        return encounterCandidatesModel;
    }

    void publishFilterOptions(CreatureFilterOptionsResult result) {
        filterOptions.publish(result);
    }

    void publishCatalog(CreatureCatalogPageResult result) {
        catalog.publish(result);
    }

    void publishDetail(CreatureDetailResult result) {
        detail.publish(result);
    }

    void publishEncounterCandidates(CreatureEncounterCandidatesResult result) {
        encounterCandidates.publish(result);
    }
}
