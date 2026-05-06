package src.domain.encounter.application;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import src.domain.creatures.published.CreatureDetail;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterTuningIntent;

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

    public static String difficultyLabel(EncounterDifficultyIntent band) {
        return switch (band == null ? EncounterDifficultyIntent.MEDIUM : band) {
            case EASY -> "Easy";
            case MEDIUM -> "Medium";
            case HARD -> "Hard";
            case DEADLY -> "Deadly";
        };
    }

    public static String tuningLabel(EncounterTuningIntent tuning) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return "B" + effective.balanceLevel()
                + "/M" + Math.round(effective.amountValue())
                + "/D" + effective.diversityLevel();
    }
}
