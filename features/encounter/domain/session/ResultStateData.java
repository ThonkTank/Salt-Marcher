package features.encounter.domain.session;

import java.util.List;

public record ResultStateData(
        List<ResultEnemyData> enemies,
        long defeatedCount,
        int eligibleXp,
        int perPlayerXp,
        String goldSummary,
        String lootDetail,
        String awardStatus,
        boolean xpAwarded,
        boolean canAwardXp,
        int partySize
) {

    private static final String DEFAULT_GOLD_SUMMARY = "Kein Loot";

    public ResultStateData {
        enemies = enemies == null ? List.of() : List.copyOf(enemies);
        goldSummary = goldSummary == null ? DEFAULT_GOLD_SUMMARY : goldSummary;
        lootDetail = lootDetail == null ? "" : lootDetail;
        awardStatus = awardStatus == null ? "" : awardStatus;
        partySize = Math.max(1, partySize);
    }

    public static ResultStateData empty() {
        return new ResultStateData(List.of(), 0, 0, 0, DEFAULT_GOLD_SUMMARY, "", "", false, false, 1);
    }

    public ResultStateData withAwardStatus(String nextAwardStatus, boolean awarded) {
        return new ResultStateData(
                enemies,
                defeatedCount,
                eligibleXp,
                perPlayerXp,
                goldSummary,
                lootDetail,
                nextAwardStatus,
                awarded,
                !awarded && canAwardXp,
                partySize);
    }
}
