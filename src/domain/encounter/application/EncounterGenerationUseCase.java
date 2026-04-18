package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterGenerationRequest;
import src.domain.encounter.api.GeneratedEncounter;
import src.domain.party.PartyApplicationService;

import java.util.List;
import java.util.Objects;

public final class EncounterGenerationUseCase {

    private static final int SEARCH_LIMIT = 240;

    private final PartyApplicationService party;
    private final CreaturesApplicationService creatures;

    public EncounterGenerationUseCase(PartyApplicationService party, CreaturesApplicationService creatures) {
        this.party = Objects.requireNonNull(party, "party");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
    }

    public GenerateResult execute(EncounterGenerationRequest request) {
        EncounterGenerationPreparation preparation = EncounterGenerationLoader.prepare(party, creatures, request, SEARCH_LIMIT);
        if (!preparation.success()) {
            return new GenerateResult(preparation.status(), preparation.budget(), List.of(), preparation.message());
        }
        List<GeneratedEncounter> generatedEncounters = new EncounterResultAssembler(creatures)
                .assemble(preparation.drafts(), request.alternativeCount());
        return new GenerateResult(preparation.status(), preparation.budget(), generatedEncounters, preparation.message());
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

    public enum GenerateStatus {
        SUCCESS,
        NO_ACTIVE_PARTY,
        NO_CREATURES,
        INVALID_REQUEST,
        STORAGE_ERROR
    }
}
