package features.creatures.application;

import features.creatures.api.CreatureDetailModel;
import features.creatures.api.CreatureDetailResult;
import features.creatures.api.CreatureEncounterCandidatesModel;
import features.creatures.api.CreatureEncounterCandidatesResult;
import features.creatures.api.CreatureLookupStatus;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReferenceIndexModel;
import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexStatus;
import java.util.List;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class CreaturesPublishedState {

    private final PublishedState<CreatureReferenceIndexResult> referenceIndex;
    private final PublishedState<CreatureDetailResult> detail;
    private final PublishedState<CreatureEncounterCandidatesResult> encounterCandidates;
    private final CreatureReferenceIndexModel referenceIndexModel;
    private final CreatureDetailModel detailModel;
    private final CreatureEncounterCandidatesModel encounterCandidatesModel;

    public CreaturesPublishedState(UiDispatcher dispatcher) {
        referenceIndex = new PublishedState<>(
                new CreatureReferenceIndexResult(CreatureReferenceIndexStatus.LOADING, 0L, List.of()),
                dispatcher);
        detail = new PublishedState<>(
                new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null),
                dispatcher);
        encounterCandidates = new PublishedState<>(
                new CreatureEncounterCandidatesResult(CreatureQueryStatus.STORAGE_ERROR, List.of()),
                dispatcher);
        referenceIndexModel = new CreatureReferenceIndexModel(
                referenceIndex::current, referenceIndex::subscribe, referenceIndex::observeLatest);
        detailModel = new CreatureDetailModel(detail::current, detail::subscribe);
        encounterCandidatesModel = new CreatureEncounterCandidatesModel(
                encounterCandidates::current, encounterCandidates::subscribe);
    }

    public CreatureReferenceIndexModel referenceIndexModel() {
        return referenceIndexModel;
    }

    public CreatureDetailModel detailModel() {
        return detailModel;
    }

    public CreatureEncounterCandidatesModel encounterCandidatesModel() {
        return encounterCandidatesModel;
    }

    void publishReferenceIndex(CreatureReferenceIndexResult result) {
        referenceIndex.publish(result);
    }

    void publishDetail(CreatureDetailResult result) {
        detail.publish(result);
    }

    void publishEncounterCandidates(CreatureEncounterCandidatesResult result) {
        encounterCandidates.publish(result);
    }
}
