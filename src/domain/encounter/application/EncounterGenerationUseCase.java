package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterGenerationAdvisory;
import src.domain.encounter.published.EncounterGenerationDiagnostics;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.GeneratedEncounter;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;
import src.domain.encountertable.EncounterTableApplicationService;

public final class EncounterGenerationUseCase {

    private static final int SEARCH_LIMIT = 240;

    private final EncounterPartyFactsRepository party;
    private final CreaturesApplicationService creatures;
    private final @Nullable EncounterTableApplicationService encounterTables;

    public EncounterGenerationUseCase(EncounterPartyFactsRepository party, CreaturesApplicationService creatures) {
        this(party, creatures, null);
    }

    public EncounterGenerationUseCase(
            EncounterPartyFactsRepository party,
            CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.encounterTables = encounterTables;
    }

    public GenerateResult execute(EncounterGenerationRequest request) {
        EncounterGenerationPreparationUseCase preparation = PrepareEncounterGenerationUseCase.prepare(
                party,
                creatures,
                encounterTables,
                request,
                SEARCH_LIMIT);
        if (!preparation.success()) {
            return new GenerateResult(
                    preparation.status(),
                    preparation.budget(),
                    List.of(),
                    preparation.message(),
                    preparation.diagnostics(),
                    preparation.advisories());
        }
        List<GeneratedEncounter> generatedEncounters = new AssembleEncounterResultUseCase(creatures)
                .assemble(preparation.drafts(), request.alternativeCount());
        return new GenerateResult(
                preparation.status(),
                preparation.budget(),
                generatedEncounters,
                preparation.message(),
                preparation.diagnostics(),
                preparation.advisories());
    }

    public record GenerateResult(
            EncounterGenerationStatus status,
            @Nullable EncounterBudgetSummary budget,
            List<GeneratedEncounter> encounters,
            String message,
            @Nullable EncounterGenerationDiagnostics diagnostics,
            List<EncounterGenerationAdvisory> advisories
    ) {

        public GenerateResult {
            status = status == null ? EncounterGenerationStatus.defaultFailure() : status;
            encounters = encounters == null ? List.of() : List.copyOf(encounters);
            message = message == null ? "" : message;
            advisories = advisories == null ? List.of() : List.copyOf(advisories);
        }

        public GenerateResult(
                EncounterGenerationStatus status,
                @Nullable EncounterBudgetSummary budget,
                List<GeneratedEncounter> encounters,
                String message
        ) {
            this(status, budget, encounters, message, null, List.of());
        }
    }
}
