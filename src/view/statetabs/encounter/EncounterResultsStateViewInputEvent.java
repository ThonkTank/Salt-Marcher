package src.view.statetabs.encounter;

import java.util.List;

public record EncounterResultsStateViewInputEvent(
        boolean awardExperienceRequested,
        boolean returnToBuilderRequested,
        List<Boolean> selectedEnemies,
        double thresholdFraction,
        double xpFraction
) {

    public EncounterResultsStateViewInputEvent {
        selectedEnemies = selectedEnemies == null ? List.of() : List.copyOf(selectedEnemies);
    }
}
