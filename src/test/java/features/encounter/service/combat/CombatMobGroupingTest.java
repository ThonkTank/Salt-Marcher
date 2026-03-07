package features.encounter.service.combat;

import features.encounter.model.Combatant;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.EncounterSlot;
import features.encounter.model.MonsterCombatant;
import features.gamerules.model.MonsterRole;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class CombatMobGroupingTest {

    @Test
    void groupsFourIdenticalMonstersIntoMobInTurnGrouper() {
        EncounterCreatureSnapshot snapshot = snapshot(42L, "Animated Broom");
        List<Combatant> combatants = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            combatants.add(monster(snapshot, 12, i + 1));
        }

        List<CombatTurnGrouper.GroupedTurnEntry> grouped = CombatTurnGrouper.groupTurns(combatants);
        assertEquals(1, grouped.size());
        assertEquals(CombatTurnGrouper.GroupedTurnKind.MOB, grouped.get(0).kind());
        assertEquals(4, grouped.get(0).monsters().size());
        assertEquals(42L, grouped.get(0).creatureId());
        assertEquals(12, grouped.get(0).initiative());
    }

    @Test
    void startCombatGroupsSingleSlotCountFourIntoMob() {
        EncounterCreatureSnapshot snapshot = snapshot(42L, "Animated Broom");
        Encounter encounter = new Encounter(
                List.of(new EncounterSlot(snapshot, 4, MonsterRole.BRUTE)),
                "Medium",
                1,
                0,
                0,
                "test");

        CombatSetup.BuildCombatantsResult setup = CombatSetup.buildCombatants(
                List.of(),
                List.of(),
                encounter,
                List.of(12));
        assertEquals(CombatSetup.BuildCombatantsStatus.SUCCESS, setup.status());

        CombatSession session = new CombatSession();
        session.startCombat(setup.combatants());

        List<CombatTurnGrouper.GroupedTurnEntry> turns = session.getTurnEntries();
        assertEquals(1, turns.size());
        assertEquals(CombatTurnGrouper.GroupedTurnKind.MOB, turns.get(0).kind());
        assertEquals(4, turns.get(0).monsters().size());
    }

    @Test
    void startCombatGroupsFourSingleSlotsWithSameInitiativeIntoMob() {
        EncounterCreatureSnapshot snapshot = snapshot(42L, "Animated Broom");
        Encounter encounter = new Encounter(
                List.of(
                        new EncounterSlot(snapshot, 1, MonsterRole.BRUTE),
                        new EncounterSlot(snapshot, 1, MonsterRole.BRUTE),
                        new EncounterSlot(snapshot, 1, MonsterRole.BRUTE),
                        new EncounterSlot(snapshot, 1, MonsterRole.BRUTE)),
                "Medium",
                1,
                0,
                0,
                "test");

        CombatSetup.BuildCombatantsResult setup = CombatSetup.buildCombatants(
                List.of(),
                List.of(),
                encounter,
                List.of(12, 12, 12, 12));
        assertEquals(CombatSetup.BuildCombatantsStatus.SUCCESS, setup.status());

        CombatSession session = new CombatSession();
        session.startCombat(setup.combatants());

        List<CombatTurnGrouper.GroupedTurnEntry> turns = session.getTurnEntries();
        assertEquals(1, turns.size());
        assertEquals(CombatTurnGrouper.GroupedTurnKind.MOB, turns.get(0).kind());
        assertEquals(4, turns.get(0).monsters().size());
    }

    private static EncounterCreatureSnapshot snapshot(Long id, String name) {
        return new EncounterCreatureSnapshot(id, name, 25, 17, 15, 3, "1/4", "construct");
    }

    private static MonsterCombatant monster(EncounterCreatureSnapshot snapshot, int initiative, int suffix) {
        MonsterCombatant combatant = new MonsterCombatant(
                snapshot.getName() + " #" + suffix,
                initiative,
                snapshot.getInitiativeBonus(),
                snapshot.getHp(),
                snapshot.getHp(),
                snapshot.getAc(),
                snapshot);
        assertNotNull(combatant.getCreatureRef());
        return combatant;
    }
}
