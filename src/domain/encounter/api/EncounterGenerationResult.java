package src.domain.encounter.api;

import org.jspecify.annotations.Nullable;

import java.util.List;

public record EncounterGenerationResult(
        EncounterGenerationStatus status,
        @Nullable EncounterBudgetSummary budget,
        List<GeneratedEncounter> encounters,
        String message
) {

    public EncounterGenerationResult {
        status = status == null ? EncounterGenerationStatus.STORAGE_ERROR : status;
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        message = message == null ? "" : message;
    }
}
