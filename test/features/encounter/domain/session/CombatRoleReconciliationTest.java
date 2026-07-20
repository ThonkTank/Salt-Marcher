package features.encounter.domain.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

final class CombatRoleReconciliationTest {

    private static final long WORLD_NPC_ID = 7001L;

    @Test
    void allyDoesNotCountAsEnemyOrBlockDefeatAndAwardsNoEnemyXp() {
        CombatRoster roster = new CombatRoster();
        CombatRosterBuilder builder = new CombatRosterBuilder();
        EncounterCreatureData ally = creature("ally", WORLD_NPC_ID, "Verbündete", 100);
        EncounterCreatureData enemy = creature("enemy", 7002L, "Gegner", 200);
        builder.addAlly(roster, ally, 15);
        builder.addMonsters(roster, enemy, 12, 1);
        roster.replaceAll(roster.combatants().stream()
                .map(combatant -> combatant.kind().enemy() ? combatant.withHp(0) : combatant)
                .toList());

        CombatRosterMutation mutations = new CombatRosterMutation();
        List<ResultEnemyData> enemies = mutations.resultEnemies(roster);
        CombatProjectionData projection = new CombatTurn().combatProjection(roster.combatants(), 0, 1);
        CombatResolutionTracker resolution = new CombatResolutionTracker();
        resolution.endCombat(mutations, roster, 4, true);

        assertEquals(1, enemies.size());
        assertEquals("Gegner", enemies.getFirst().name());
        assertEquals("0/1 - Kippt", projection.status());
        assertTrue(projection.allEnemiesDefeated());
        assertEquals(1, resolution.resultState().defeatedCount());
        assertEquals(200, resolution.resultState().eligibleXp());
        assertEquals(50, resolution.resultState().perPlayerXp());
    }

    @Test
    void sceneNpcRoleChangesReconcileExistingCombatantWithoutResettingCombatState() {
        CombatRoster roster = new CombatRoster();
        CombatRosterBuilder builder = new CombatRosterBuilder();
        EncounterCreatureData npc = creature("scene-npc", WORLD_NPC_ID, "Wache", 100);
        builder.addMonsters(roster, npc, 17, 0);
        Combatant damagedEnemy = roster.combatants().getFirst().withHp(3);
        roster.replaceAll(List.of(damagedEnemy));

        CombatTurn turns = new CombatTurn();
        CombatTurnTracker tracker = new CombatTurnTracker();
        tracker.restoreState(0, 4);
        CombatantId activeTurn = tracker.activeTurnId(turns, roster);

        roster.reconcileSceneNpcs(List.of(), List.of(npc), builder);
        tracker.restore(turns, roster, activeTurn);

        Combatant ally = roster.combatants().getFirst();
        assertEquals(damagedEnemy.id(), ally.id());
        assertEquals(CombatantKind.ALLY_NPC, ally.kind());
        assertEquals(3, ally.currentHp());
        assertEquals(damagedEnemy.maxHp(), ally.maxHp());
        assertEquals(17, ally.initiative());
        assertEquals(damagedEnemy.order(), ally.order());
        assertEquals(4, tracker.round());
        assertEquals(activeTurn, tracker.activeTurnId(turns, roster));

        roster.reconcileSceneNpcs(List.of(npc), List.of(), builder);
        tracker.restore(turns, roster, activeTurn);

        Combatant enemyAgain = roster.combatants().getFirst();
        assertEquals(damagedEnemy.id(), enemyAgain.id());
        assertEquals(CombatantKind.MONSTER, enemyAgain.kind());
        assertEquals(3, enemyAgain.currentHp());
        assertEquals(17, enemyAgain.initiative());
        assertEquals(4, tracker.round());
        assertEquals(activeTurn, tracker.activeTurnId(turns, roster));
    }

    private static EncounterCreatureData creature(
            String id,
            long worldNpcId,
            String name,
            int xp
    ) {
        return new EncounterCreatureData(
                id,
                worldNpcId,
                worldNpcId,
                name,
                "1",
                xp,
                12,
                14,
                2,
                "Humanoid",
                "Scene NPC",
                1,
                List.of());
    }
}
