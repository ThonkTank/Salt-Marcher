package features.encounter.ui.combat;

import features.encounter.model.Combatant;
import features.encounter.service.combat.CombatSession;
import features.encounter.service.combat.CombatTurnGrouper;

import java.util.List;

record CombatTrackerRenderState(
        int round,
        int currentTurnIndex,
        int focusedIndex,
        String currentTurnName,
        List<Combatant> combatants,
        List<CombatTurnGrouper.GroupedTurnEntry> turnEntries,
        List<CombatSession.InactiveEnemy> inactiveEnemies,
        List<CombatSession.EnemyOutcome> enemyOutcomes,
        CombatSession.EnemyTotals enemyTotals) {

    static CombatTrackerRenderState empty() {
        return new CombatTrackerRenderState(
                1,
                0,
                0,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                new CombatSession.EnemyTotals(0, 0));
    }

    CombatTurnGrouper.GroupedTurnEntry focusedEntry() {
        return (focusedIndex >= 0 && focusedIndex < turnEntries.size()) ? turnEntries.get(focusedIndex) : null;
    }
}
