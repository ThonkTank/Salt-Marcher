package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.reference.port.EncounterCreatureLookup;
import src.domain.encounter.reference.port.EncounterTableCandidateLookup;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;

public final class EncounterGenerationUseCase {

    private static final int SEARCH_LIMIT = 240;

    private final EncounterPartyFactsRepository party;
    private final EncounterCreatureLookup creatures;
    private final @Nullable EncounterTableCandidateLookup encounterTables;

    public EncounterGenerationUseCase(EncounterPartyFactsRepository party, EncounterCreatureLookup creatures) {
        this(party, creatures, null);
    }

    public EncounterGenerationUseCase(
            EncounterPartyFactsRepository party,
            EncounterCreatureLookup creatures,
            @Nullable EncounterTableCandidateLookup encounterTables
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
                    false,
                    List.of(),
                    preparation.message(),
                    preparation.diagnostics(),
                    preparation.autoResolved(),
                    preparation.fallbackUsed());
        }
        List<GeneratedAlternative> generatedEncounters = new AssembleEncounterResultUseCase(creatures)
                .assemble(preparation.drafts(), request.alternativeCount());
        return new GenerateResult(
                true,
                generatedEncounters,
                preparation.message(),
                preparation.diagnostics(),
                preparation.autoResolved(),
                preparation.fallbackUsed());
    }

    public record GenerateResult(
            boolean success,
            List<GeneratedAlternative> encounters,
            String message,
            @Nullable EncounterGenerationDiagnosticsData diagnostics,
            boolean autoResolved,
            boolean fallbackUsed
    ) {

        public GenerateResult {
            encounters = encounters == null ? List.of() : List.copyOf(encounters);
            message = message == null ? "" : message;
        }

        public GenerateResult(
                boolean success,
                List<GeneratedAlternative> encounters,
                String message
        ) {
            this(success, encounters, message, null, false, false);
        }
    }

    record GeneratedCreature(
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int quantity,
            String role,
            List<String> tags
    ) {

        GeneratedCreature {
            name = name == null ? "" : name;
            challengeRating = challengeRating == null ? "" : challengeRating;
            role = role == null ? "" : role;
            quantity = Math.max(1, quantity);
            tags = tags == null ? List.of() : List.copyOf(tags);
        }
    }

    record GeneratedAlternative(
            String title,
            src.domain.encounter.generation.value.EncounterDifficultyIntent achievedDifficulty,
            int adjustedXp,
            List<GeneratedCreature> creatures
    ) {

        GeneratedAlternative {
            title = title == null ? "" : title;
            achievedDifficulty = achievedDifficulty == null
                    ? src.domain.encounter.generation.value.EncounterDifficultyIntent.MEDIUM
                    : achievedDifficulty;
            adjustedXp = Math.max(0, adjustedXp);
            creatures = creatures == null ? List.of() : List.copyOf(creatures);
        }
    }
}
