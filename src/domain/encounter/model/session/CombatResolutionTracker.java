package src.domain.encounter.model.session;

import java.util.List;

final class CombatResolutionTracker {

    private static final String NO_LOOT = "Kein Loot";
    private static final String LOOT_DETAIL = "Loot-Persistenz ist in diesem Generator-Pass nicht angebunden.";
    private static final String XP_AWARDED_STATUS = "XP an die aktive Party verteilt.";
    private static final String XP_AWARD_FAILED_STATUS = "XP konnte nicht verteilt werden.";
    private static final int MINIMUM_PARTY_SIZE = 1;
    private ResultStateData resultState = ResultStateData.empty();

    void reset() {
        resultState = ResultStateData.empty();
    }

    void endCombat(CombatRosterMutation combatRosterMutations, CombatRoster combatRoster, int activePartySize, boolean hasActiveParty) {
        List<ResultEnemyData> enemies = combatRosterMutations.resultEnemies(combatRoster);
        int eligibleXp = 0;
        long defeatedEnemies = 0;
        for (ResultEnemyData enemy : enemies) {
            if (enemy.defeatedByDefault()) {
                eligibleXp += enemy.xp();
                defeatedEnemies++;
            }
        }
        int partySize = Math.max(MINIMUM_PARTY_SIZE, activePartySize);
        resultState = new ResultStateData(
                enemies,
                defeatedEnemies,
                eligibleXp,
                eligibleXp / partySize,
                NO_LOOT,
                LOOT_DETAIL,
                "",
                false,
                hasActiveParty,
                partySize);
    }

    void awardXp(EncounterSession.SessionRepository access, EncounterSessionContext context) {
        if (resultState.xpAwarded() || resultState.perPlayerXp() <= 0 || !context.hasActiveParty()) {
            return;
        }
        List<Long> partyMemberIds = new java.util.ArrayList<>();
        for (PartyMemberData member : context.activeParty()) {
            partyMemberIds.add(member.numericId());
        }
        AwardXpOutcome outcome = access.awardXp(
                List.copyOf(partyMemberIds),
                resultState.perPlayerXp());
        resultState = resultState.withAwardStatus(
                outcome.success() ? XP_AWARDED_STATUS : XP_AWARD_FAILED_STATUS,
                outcome.success());
        if (outcome.success()) {
            context.refresh(access);
        }
    }

    ResultStateData resultState() {
        return resultState;
    }

    void restore(ResultStateData state) {
        resultState = state == null ? ResultStateData.empty() : state;
    }
}
