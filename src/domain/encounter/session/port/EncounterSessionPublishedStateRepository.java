package src.domain.encounter.session.port;

import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;

public interface EncounterSessionPublishedStateRepository {

    void publishCurrentSession(
            EncounterStateSnapshot state,
            EncounterBuilderInputs builderInputs,
            EncounterTuningPreviewResult tuningPreview
    );

    EncounterStateModel stateModel();

    EncounterBuilderInputsModel builderInputsModel();

    EncounterTuningPreviewModel tuningPreviewModel();
}
