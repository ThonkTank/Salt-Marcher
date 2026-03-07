package features.encounter.ui.combat;

import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.Combatant;
import features.encounter.model.MonsterCombatant;
import features.encounter.service.combat.CombatTurnGrouper;
import org.junit.jupiter.api.Test;
import ui.components.statblock.StatBlockRequest;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class CombatStatBlockRequestMapperTest {

    @Test
    void mapsMonsterEntryToCreatureRequest() {
        CombatTurnGrouper.GroupedTurnEntry entry = new CombatTurnGrouper.GroupedTurnEntry(
                CombatTurnGrouper.GroupedTurnKind.MONSTER,
                null,
                List.of(),
                42L,
                12,
                "Wolf",
                13);

        StatBlockRequest request = CombatStatBlockRequestMapper.fromTurnEntry(entry);
        assertEquals(42L, request.creatureId());
        assertNull(request.mobCount());
    }

    @Test
    void mapsMobEntryToMobRequest() {
        EncounterCreatureSnapshot snapshot = new EncounterCreatureSnapshot(99L, "Animated Broom", 25, 17, 15, 3, "1/4", "construct");
        List<Combatant> combatants = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            combatants.add(new MonsterCombatant(
                    "Animated Broom #" + (i + 1),
                    10,
                    snapshot.getInitiativeBonus(),
                    snapshot.getHp(),
                    snapshot.getHp(),
                    snapshot.getAc(),
                    snapshot));
        }
        CombatTurnGrouper.GroupedTurnEntry entry = CombatTurnGrouper.groupTurns(combatants).get(0);

        StatBlockRequest request = CombatStatBlockRequestMapper.fromTurnEntry(entry);
        assertEquals(99L, request.creatureId());
        assertEquals(4, request.mobCount());
    }
}
