package src.domain.encounter.model.session.repository;

import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewResult;

public interface EncounterSessionPublishedStateRepository {

    void publishCurrentSession(
            EncounterStateSnapshot state,
            EncounterBuilderInputs builderInputs,
            EncounterTuningPreviewResult tuningPreview);
}
