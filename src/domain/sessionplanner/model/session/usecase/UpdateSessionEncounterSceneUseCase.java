package src.domain.sessionplanner.model.session.usecase;

import java.util.Objects;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionLocationReferencePort;

public final class UpdateSessionEncounterSceneUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;
    private final SessionLocationReferencePort locationValidator;

    public UpdateSessionEncounterSceneUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase,
            SessionLocationReferencePort locationValidator
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
        this.locationValidator = Objects.requireNonNull(locationValidator, "locationValidator");
    }

    public void execute(long encounterId, String sceneTitle, String sceneNotes, long locationId) {
        SessionPlan session = loadCurrentSessionPlanUseCase.execute();
        if (locationId > 0L && !locationValidator.locationExists(locationId)) {
            saveCurrentSessionPlanUseCase.execute(session.withStatus("Location nicht gefunden."));
            return;
        }
        saveCurrentSessionPlanUseCase.execute(session.updateEncounterScene(encounterId, sceneTitle, sceneNotes, locationId));
    }
}
