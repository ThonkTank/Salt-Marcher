package src.domain.encounter.model.session.model;

import java.util.List;
import src.domain.encounter.model.session.model.CombatRosterMutation;
import src.domain.encounter.model.session.model.EncounterSessionValues.AwardXpOutcome;
import src.domain.encounter.model.session.model.EncounterSessionValues.PartyMemberData;
import src.domain.encounter.model.session.model.EncounterSessionValues.ResultEnemyData;
import src.domain.encounter.model.session.model.EncounterSessionValues.ResultStateData;

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
        int eligibleXp = enemies.stream()
                .filter(ResultEnemyData::defeatedByDefault)
                .mapToInt(ResultEnemyData::xp)
                .sum();
        int partySize = Math.max(MINIMUM_PARTY_SIZE, activePartySize);
        resultState = new ResultStateData(
                enemies,
                enemies.stream().filter(ResultEnemyData::defeatedByDefault).count(),
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
        AwardXpOutcome outcome = access.awardXp(
                context.activeParty().stream().map(PartyMemberData::numericId).toList(),
                resultState.perPlayerXp());
        resultState = resultState.withAwardStatus(
                outcome.success() ? XP_AWARDED_STATUS : XP_AWARD_FAILED_STATUS,
                outcome.success());
        if (outcome.success()) {
            context.refresh(access, false);
        }
    }

    ResultStateData resultState() {
        return resultState;
    }
}
