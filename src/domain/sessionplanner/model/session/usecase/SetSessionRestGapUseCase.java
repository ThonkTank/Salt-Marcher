package src.domain.sessionplanner.model.session.usecase;

import src.domain.sessionplanner.model.session.model.SessionRestPlacement;

public final class SetSessionRestGapUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public SetSessionRestGapUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute(long leftEncounterId, long rightEncounterId, String restKind) {
        saveCurrentSessionPlanUseCase.execute(loadCurrentSessionPlanUseCase.execute().setRestPlacement(
                toRestPlacement(leftEncounterId, rightEncounterId, restKind)));
    }

    private static SessionRestPlacement toRestPlacement(long leftEncounterId, long rightEncounterId, String restKind) {
        return switch (restKind == null ? "" : restKind) {
            case "SHORT_REST" -> SessionRestPlacement.shortRestBetween(leftEncounterId, rightEncounterId);
            case "LONG_REST" -> SessionRestPlacement.longRestBetween(leftEncounterId, rightEncounterId);
            default -> throw new IllegalArgumentException("Rest kind has no placement.");
        };
    }
}
