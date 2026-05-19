package src.domain.encounter.model.session.repository;

import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.model.generation.model.EncounterBudgetSummary;
import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.model.EncounterGenerationDiagnosticsData;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.session.model.BudgetData;
import src.domain.encounter.model.session.model.CreatureDetailData;
import src.domain.encounter.model.session.model.GeneratedEncounterData;
import src.domain.encounter.model.session.model.GenerationDiagnosticsData;

final class EncounterSessionDataMapperRepository {

    private final EncounterSessionCreatureDataRepository creatures;

    EncounterSessionDataMapperRepository(EncounterCreatureRepository creatures) {
        this.creatures = new EncounterSessionCreatureDataRepository(creatures);
    }

    GeneratedEncounterData toGeneratedEncounter(
            EncounterGenerationUseCase.GeneratedAlternative encounter,
            boolean autoResolved,
            boolean fallbackUsed
    ) {
        return new GeneratedEncounterData(
                encounter.title(),
                difficultyLabel(encounter.achievedDifficulty()),
                encounter.adjustedXp(),
                encounter.creatures().stream().map(creatures::toCreature).toList(),
                creatures.advisoryMessages(autoResolved, fallbackUsed));
    }

    Optional<GenerationDiagnosticsData> toDiagnostics(@Nullable EncounterGenerationDiagnosticsData diagnostics) {
        if (diagnostics == null) {
            return Optional.empty();
        }
        return Optional.of(new GenerationDiagnosticsData(
                difficultyLabel(diagnostics.resolvedDifficulty()),
                tuningLabel(diagnostics.resolvedTuning())));
    }

    Optional<CreatureDetailData> toCreatureDetail(long creatureId) {
        return creatures.toCreatureDetail(creatureId);
    }

    BudgetData toSessionBudget(EncounterBudgetSummary budget) {
        return new BudgetData(
                budget.activePartyLevels(),
                budget.averagePartyLevel(),
                budget.easyThreshold(),
                budget.mediumThreshold(),
                budget.hardThreshold(),
                budget.deadlyThreshold());
    }

    String defaultMessage(@Nullable String message, String fallback) {
        return message == null || message.isBlank() ? fallback : message;
    }

    private static String difficultyLabel(EncounterDifficultyIntent band) {
        EncounterDifficultyIntent effective = band == null ? EncounterDifficultyIntent.MEDIUM : band;
        return switch (effective.name()) {
            case "EASY" -> "Easy";
            case "HARD" -> "Hard";
            case "DEADLY" -> "Deadly";
            default -> "Medium";
        };
    }

    private static String tuningLabel(EncounterTuningIntent tuning) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return "B" + effective.balanceLevel()
                + "/M" + Math.round(effective.amountValue())
                + "/D" + effective.diversityLevel();
    }
}
