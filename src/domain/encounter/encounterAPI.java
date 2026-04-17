package src.domain.encounter;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.creaturesAPI;
import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationRequest;
import src.domain.encounter.api.GeneratedEncounter;
import src.domain.encounter.usecase.EncounterGenerationUseCase;
import src.domain.party.partyAPI;

import java.util.List;
import java.util.Objects;

/**
 * Public encounter-generator facade that composes party and creature feature APIs.
 */
public final class encounterAPI {

    private final EncounterGenerationUseCase generator;

    public encounterAPI(partyAPI party, creaturesAPI creatures) {
        this.generator = new EncounterGenerationUseCase(
                Objects.requireNonNull(party, "party"),
                Objects.requireNonNull(creatures, "creatures"));
    }

    public enum GenerateStatus {
        SUCCESS,
        NO_ACTIVE_PARTY,
        NO_CREATURES,
        INVALID_REQUEST,
        STORAGE_ERROR
    }

    public record GenerateResult(
            GenerateStatus status,
            @Nullable EncounterBudgetSummary budget,
            List<GeneratedEncounter> encounters,
            String message
    ) {

        public GenerateResult {
            encounters = encounters == null ? List.of() : List.copyOf(encounters);
            message = message == null ? "" : message;
        }
    }

    public GenerateResult generate(EncounterGenerationRequest request) {
        try {
            EncounterGenerationUseCase.GenerateResult result = generator.execute(request == null
                    ? new EncounterGenerationRequest(List.of(), List.of(), List.of(), EncounterDifficultyBand.MEDIUM, 5, List.of(), List.of())
                    : request);
            return new GenerateResult(
                    mapStatus(result.status()),
                    result.budget(),
                    result.encounters(),
                    result.message());
        } catch (RuntimeException exception) {
            return new GenerateResult(GenerateStatus.STORAGE_ERROR, null, List.of(), "Encounter generation failed.");
        }
    }

    private static GenerateStatus mapStatus(EncounterGenerationUseCase.GenerateStatus status) {
        return switch (status) {
            case SUCCESS -> GenerateStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> GenerateStatus.NO_ACTIVE_PARTY;
            case NO_CREATURES -> GenerateStatus.NO_CREATURES;
            case INVALID_REQUEST -> GenerateStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> GenerateStatus.STORAGE_ERROR;
        };
    }
}
