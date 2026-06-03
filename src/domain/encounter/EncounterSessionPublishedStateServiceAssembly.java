package src.domain.encounter;

import src.domain.encounter.model.session.EncounterSessionPublicationData;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewResult;

final class EncounterSessionPublishedStateServiceAssembly implements EncounterSessionPublishedStateRepository {

    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";

    private final EncounterPublishedStateChannelServiceAssembly<EncounterStateSnapshot> state =
            new EncounterPublishedStateChannelServiceAssembly<>(EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED));
    private final EncounterPublishedStateChannelServiceAssembly<EncounterBuilderInputs> builderInputs =
            new EncounterPublishedStateChannelServiceAssembly<>(EncounterBuilderInputs.empty());
    private final EncounterPublishedStateChannelServiceAssembly<EncounterTuningPreviewResult> tuningPreview =
            new EncounterPublishedStateChannelServiceAssembly<>(
                    EncounterTuningPreviewProjectionServiceAssembly.emptyTuningPreview());
    private final src.domain.encounter.published.EncounterStateModel stateModel =
            new src.domain.encounter.published.EncounterStateModel(
                    state::current,
                    state::subscribe);
    private final src.domain.encounter.published.EncounterBuilderInputsModel builderInputsModel =
            new src.domain.encounter.published.EncounterBuilderInputsModel(
                    builderInputs::current,
                    builderInputs::subscribe);
    private final src.domain.encounter.published.EncounterTuningPreviewModel tuningPreviewModel =
            new src.domain.encounter.published.EncounterTuningPreviewModel(
                    tuningPreview::current,
                    tuningPreview::subscribe);

    src.domain.encounter.published.EncounterStateModel stateModel() {
        return stateModel;
    }

    src.domain.encounter.published.EncounterBuilderInputsModel builderInputsModel() {
        return builderInputsModel;
    }

    src.domain.encounter.published.EncounterTuningPreviewModel tuningPreviewModel() {
        return tuningPreviewModel;
    }

    @Override
    public void publishCurrentSession(EncounterSessionPublicationData publication) {
        EncounterSessionPublicationData effective = publication == null
                ? EncounterSessionPublicationData.unavailable(SESSION_NOT_REGISTERED)
                : publication;
        state.publish(EncounterSessionSnapshotProjectionServiceAssembly.toPublishedSnapshot(
                effective,
                SESSION_NOT_REGISTERED));
        builderInputs.publish(EncounterBuilderInputsProjectionServiceAssembly.toPublishedBuilderInputs(
                effective.builderInputs()));
        tuningPreview.publish(EncounterTuningPreviewProjectionServiceAssembly.toPublishedTuningPreview(
                effective.tuningPreview()));
    }
}
