package src.domain.encounter.model.session.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.EncounterBudgetSummary;
import src.domain.encounter.model.generation.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.EncounterGeneratedAlternative;
import src.domain.encounter.model.generation.EncounterGenerationDiagnosticsData;
import src.domain.encounter.model.generation.EncounterTuningIntent;
import src.domain.encounter.model.generation.GeneratedEncounterCreatureData;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.session.BudgetData;
import src.domain.encounter.model.session.CreatureDetailData;
import src.domain.encounter.model.session.EncounterCreatureData;
import src.domain.encounter.model.session.GeneratedEncounterData;
import src.domain.encounter.model.session.GenerationDiagnosticsData;

final class EncounterSessionDataMapperRepository {

    private final EncounterSessionCreatureDataRepository creatures;

    EncounterSessionDataMapperRepository(
            EncounterCreatureRepository creatures,
            Object creatureCatalog
    ) {
        this.creatures = new EncounterSessionCreatureDataRepository(creatures, creatureCatalog);
    }

    GeneratedEncounterData toGeneratedEncounter(
            EncounterGeneratedAlternative encounter,
            boolean autoResolved,
            boolean fallbackUsed
    ) {
        List<GeneratedEncounterCreatureData> sourceCreatures = encounter.creatures();
        List<EncounterCreatureData> encounterCreatures = new ArrayList<>();
        for (GeneratedEncounterCreatureData creature : sourceCreatures) {
            encounterCreatures.add(creatures.toCreature(creature));
        }
        return new GeneratedEncounterData(
                encounter.title(),
                difficultyLabel(encounter.achievedDifficulty()),
                encounter.adjustedXp(),
                List.copyOf(encounterCreatures),
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
