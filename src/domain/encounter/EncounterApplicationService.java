package src.domain.encounter;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationResult;
import src.domain.encounter.api.EncounterGenerationStatus;
import src.domain.encounter.api.EncounterGenerationRequest;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.party.PartyApplicationService;

import java.util.List;
import java.util.Objects;

/**
 * Public encounter-generator facade that composes party and creature
 * application services.
 */
public final class EncounterApplicationService {

    private final EncounterGenerationUseCase generator;

    public EncounterApplicationService(PartyApplicationService party, CreaturesApplicationService creatures) {
        this.generator = new EncounterGenerationUseCase(
                Objects.requireNonNull(party, "party"),
                Objects.requireNonNull(creatures, "creatures"));
    }

    public EncounterGenerationResult generate(EncounterGenerationRequest request) {
        try {
            EncounterGenerationUseCase.GenerateResult result = generator.execute(request == null
                    ? new EncounterGenerationRequest(List.of(), List.of(), List.of(), EncounterDifficultyBand.MEDIUM, 5, List.of(), List.of())
                    : request);
            return new EncounterGenerationResult(
                    mapStatus(result.status()),
                    result.budget(),
                    result.encounters(),
                    result.message());
        } catch (RuntimeException exception) {
            return new EncounterGenerationResult(EncounterGenerationStatus.STORAGE_ERROR, null, List.of(), "Encounter generation failed.");
        }
    }

    private static EncounterGenerationStatus mapStatus(EncounterGenerationUseCase.GenerateStatus status) {
        return switch (status) {
            case SUCCESS -> EncounterGenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.NO_ACTIVE_PARTY;
            case NO_CREATURES -> EncounterGenerationStatus.NO_CREATURES;
            case INVALID_REQUEST -> EncounterGenerationStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterGenerationStatus.STORAGE_ERROR;
        };
    }
}
