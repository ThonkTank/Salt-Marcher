package features.encountertable.application;

import features.encountertable.api.EncounterTableCandidatesModel;
import features.encountertable.api.EncounterTableCandidatesResult;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import java.util.List;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class EncounterTablePublishedState {

    private final PublishedState<EncounterTableCatalogResult> catalog;
    private final PublishedState<EncounterTableCandidatesResult> candidates;
    private final EncounterTableCatalogModel catalogModel;
    private final EncounterTableCandidatesModel candidatesModel;

    public EncounterTablePublishedState(UiDispatcher dispatcher) {
        catalog = new PublishedState<>(
                new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of()),
                dispatcher);
        candidates = new PublishedState<>(
                new EncounterTableCandidatesResult(EncounterTableReadStatus.STORAGE_ERROR, List.of()),
                dispatcher);
        catalogModel = new EncounterTableCatalogModel(
                catalog::current, catalog::subscribe, catalog::observeLatest);
        candidatesModel = new EncounterTableCandidatesModel(candidates::current, candidates::subscribe);
    }

    public EncounterTableCatalogModel catalogModel() {
        return catalogModel;
    }

    public EncounterTableCandidatesModel candidatesModel() {
        return candidatesModel;
    }

    void publishCatalog(EncounterTableCatalogResult result) {
        catalog.publish(result);
    }

    void publishCandidates(EncounterTableCandidatesResult result) {
        candidates.publish(result);
    }
}
