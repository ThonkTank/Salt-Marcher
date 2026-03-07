package features.encounter.service.combat;

import features.encounter.model.MonsterCombatant;

import java.util.List;

/**
 * Domain rules for post-combat outcome and XP settlement.
 */
public final class CombatOutcomeService {
    private CombatOutcomeService() {
        throw new AssertionError("No instances");
    }

    public record XpSettlement(int defeatedCount, int eligibleXp, int awardedXp, int perPlayerXp) {}

    public static XpSettlement settleXp(
            List<CombatSession.EnemyOutcome> outcomes,
            int partySize,
            double defeatThreshold,
            double xpFraction) {

        int safePartySize = Math.max(1, partySize);
        double safeThreshold = clamp01(defeatThreshold);
        double safeFraction = clamp01(xpFraction);

        int defeated = 0;
        int totalXp = 0;
        if (outcomes == null || outcomes.isEmpty()) {
            return new XpSettlement(0, 0, 0, 0);
        }

        for (CombatSession.EnemyOutcome outcome : outcomes) {
            if (outcome == null || outcome.combatant() == null) {
                continue;
            }
            MonsterCombatant combatant = outcome.combatant();
            if (hpLostRatio(combatant) >= safeThreshold) {
                defeated++;
                totalXp += combatant.getCreatureRef() != null ? combatant.getCreatureRef().getXp() : 0;
            }
        }

        int awarded = (int) Math.round(totalXp * safeFraction);
        int perPlayer = awarded / safePartySize;
        return new XpSettlement(defeated, totalXp, awarded, perPlayer);
    }

    static double hpLostRatio(MonsterCombatant combatant) {
        return combatant.getMaxHp() > 0
                ? (double) (combatant.getMaxHp() - combatant.getCurrentHp()) / combatant.getMaxHp()
                : 1.0;
    }

    private static double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }
}
