package src.domain.encounter.application;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import src.domain.creatures.published.CreatureDetail;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationTuning;

public final class EncounterSessionRuntimeProjector {

    private EncounterSessionRuntimeProjector() {
    }

    public static BudgetData toSessionBudget(EncounterDifficultyMath.BudgetSummary budget) {
        return new BudgetData(
                budget.activePartyLevels(),
                budget.averagePartyLevel(),
                budget.easyThreshold(),
                budget.mediumThreshold(),
                budget.hardThreshold(),
                budget.deadlyThreshold());
    }

    public static CreatureDetailData toSessionCreatureDetail(CreatureDetail detail) {
        return new CreatureDetailData(
                detail.id(),
                detail.name(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.creatureType());
    }

    public static String difficultyLabel(EncounterDifficultyBand band) {
        EncounterDifficultyBand effective = band == null ? EncounterDifficultyBand.defaultBand() : band;
        return switch (effective.name()) {
            case "EASY" -> "Easy";
            case "HARD" -> "Hard";
            case "DEADLY" -> "Deadly";
            default -> "Medium";
        };
    }

    public static String tuningLabel(EncounterGenerationTuning tuning) {
        EncounterGenerationTuning effective = tuning == null ? EncounterGenerationTuning.defaultTuning() : tuning;
        return "B" + effective.balanceLevel()
                + "/M" + Math.round(effective.amountValue())
                + "/D" + effective.diversityLevel();
    }
}
