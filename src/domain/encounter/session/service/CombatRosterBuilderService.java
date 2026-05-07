package src.domain.encounter.session.service;

import java.util.List;
import src.domain.encounter.session.entity.CombatRoster;
import src.domain.encounter.session.value.Combatant;
import src.domain.encounter.session.value.EncounterSessionValues.CreatureDetailData;
import src.domain.encounter.session.value.EncounterSessionValues.EncounterCreatureData;
import src.domain.encounter.session.value.MonsterCombatProfile;

public final class CombatRosterBuilderService {

    private static final int DEFAULT_PLAYER_INITIATIVE = 10;
    private static final int DEFAULT_MONSTER_INITIATIVE = 12;
    private static final int MIN_INITIATIVE_BONUS = -3;
    private static final int MAX_INITIATIVE_BONUS = 6;
    private static final String REINFORCEMENT_ID_PREFIX = "reinforcement-";

    public static int defaultPlayerInitiative(int partyIndex) {
        return DEFAULT_PLAYER_INITIATIVE + Math.max(0, partyIndex);
    }

    public static int defaultMonsterInitiative(int initiativeBonus) {
        return DEFAULT_MONSTER_INITIATIVE + Math.max(MIN_INITIATIVE_BONUS, Math.min(MAX_INITIATIVE_BONUS, initiativeBonus));
    }

    public int addPlayer(CombatRoster roster, String id, String name, int initiative, int order) {
        roster.add(Combatant.playerCharacter(id, name, initiative, order));
        return order + 1;
    }

    public int addMonsters(CombatRoster roster, EncounterCreatureData creature, int initiative, int order) {
        MonsterCombatProfile profile = MonsterCombatProfile.fromEncounterCreature(creature);
        return addMonsterMembers(roster, profile, creature.count(), creature.id(), initiative, order, nextMonsterOrdinal(roster.combatants(), profile.creatureId()));
    }

    public String addReinforcement(CombatRoster roster, CreatureDetailData creature, String role, int initiative) {
        MonsterCombatProfile profile = MonsterCombatProfile.fromReinforcement(creature, role);
        int nextOrdinal = nextMonsterOrdinal(roster.combatants(), profile.creatureId());
        int nextOrder = nextOrder(roster.combatants());
        String displayName = uniqueMonsterName(profile.name(), nextOrdinal);
        String id = REINFORCEMENT_ID_PREFIX + profile.creatureId() + "-" + nextOrdinal;
        roster.add(Combatant.monsterMember(id, displayName, profile, initiative, nextOrder, 1));
        roster.sort();
        return displayName;
    }

    public boolean addPlayerToRunningCombat(CombatRoster roster, String id, String name, int initiative) {
        if (roster.containsId(id)) {
            return false;
        }
        roster.add(Combatant.playerCharacter(id, name, initiative, nextOrder(roster.combatants())));
        roster.sort();
        return true;
    }

    private static int addMonsterMembers(
            CombatRoster roster,
            MonsterCombatProfile profile,
            int count,
            String sourceId,
            int initiative,
            int order,
            int firstOrdinal
    ) {
        int nextOrder = order;
        for (int creatureIndex = 1; creatureIndex <= count; creatureIndex++) {
            String displayName = count == 1 ? uniqueMonsterName(profile.name(), firstOrdinal) : profile.name();
            roster.add(Combatant.monsterMember(sourceId, displayName, profile, initiative, nextOrder, count == 1 ? 1 : creatureIndex));
            nextOrder++;
        }
        return nextOrder;
    }

    private static int nextMonsterOrdinal(List<Combatant> combatants, long creatureId) {
        int count = 0;
        for (Combatant combatant : combatants) {
            if (!combatant.isPlayerCharacter() && combatant.creatureId() == creatureId) {
                count++;
            }
        }
        return count + 1;
    }

    private static int nextOrder(List<Combatant> combatants) {
        int order = 0;
        for (Combatant combatant : combatants) {
            order = Math.max(order, combatant.order() + 1);
        }
        return order;
    }

    private static String uniqueMonsterName(String name, int ordinal) {
        return ordinal <= 1 ? name : name + " #" + ordinal;
    }
}
