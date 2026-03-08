package features.encounter.service.combat;

import features.encounter.model.MonsterCombatant;
import features.gamerules.model.LootCoins;

import java.util.List;
import java.util.Set;

/**
 * Domain rules for post-combat outcome and XP settlement.
 */
public final class CombatOutcomeService {
    private CombatOutcomeService() {
        throw new AssertionError("No instances");
    }

    public record XpSettlement(int defeatedCount, int eligibleXp, int awardedXp, int perPlayerXp) {}
    public record CombatRewardsSettlement(
            XpSettlement xpSettlement,
            LootCoins deadLoot,
            LootCoins optionalLoot,
            LootCoins pooledLoot,
            LootCoins perPlayerLoot) {}

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

    public static CombatRewardsSettlement settleRewards(
            List<CombatSession.EnemyOutcome> outcomes,
            int partySize,
            double defeatThreshold,
            double xpFraction,
            Set<MonsterCombatant> optionalLootCombatants) {
        XpSettlement xpSettlement = settleXp(outcomes, partySize, defeatThreshold, xpFraction);
        Set<MonsterCombatant> selected = optionalLootCombatants == null ? Set.of() : optionalLootCombatants;
        LootCoins deadLoot = LootCoins.zero();
        LootCoins optionalLoot = LootCoins.zero();
        if (outcomes != null && !outcomes.isEmpty()) {
            for (CombatSession.EnemyOutcome outcome : outcomes) {
                if (outcome == null || outcome.combatant() == null) {
                    continue;
                }
                LootCoins loot = outcome.combatant().getLootCoins();
                if (outcome.status() == CombatSession.EnemyStatus.DEAD) {
                    deadLoot = deadLoot.plus(loot);
                } else if (selected.contains(outcome.combatant())) {
                    optionalLoot = optionalLoot.plus(loot);
                }
            }
        }
        LootCoins pooledLoot = deadLoot.plus(optionalLoot);
        int safePartySize = Math.max(1, partySize);
        LootCoins perPlayerLoot = pooledLoot.dividedBy(safePartySize);
        return new CombatRewardsSettlement(xpSettlement, deadLoot, optionalLoot, pooledLoot, perPlayerLoot);
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
