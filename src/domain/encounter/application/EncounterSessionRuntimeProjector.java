package src.domain.encounter.application;

import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.encounter.reference.value.EncounterCreatureReference;
import src.domain.encounter.session.value.EncounterSessionValues.BudgetData;
import src.domain.encounter.session.value.EncounterSessionValues.CreatureDetailData;

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

    public static CreatureDetailData toSessionCreatureDetail(EncounterCreatureReference detail) {
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

    public static String difficultyLabel(EncounterDifficultyIntent band) {
        EncounterDifficultyIntent effective = band == null ? EncounterDifficultyIntent.MEDIUM : band;
        return switch (effective.name()) {
            case "EASY" -> "Easy";
            case "HARD" -> "Hard";
            case "DEADLY" -> "Deadly";
            default -> "Medium";
        };
    }

    public static String tuningLabel(EncounterTuningIntent tuning) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return "B" + effective.balanceLevel()
                + "/M" + Math.round(effective.amountValue())
                + "/D" + effective.diversityLevel();
    }
}
