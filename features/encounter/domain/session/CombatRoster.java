package features.encounter.domain.session;

import java.util.ArrayList;
import java.util.List;

public final class CombatRoster {

    private final List<Combatant> combatants = new ArrayList<>();

    public void clear() {
        combatants.clear();
    }

    public void add(Combatant combatant) {
        combatants.add(combatant);
    }

    public List<Combatant> combatants() {
        return List.copyOf(combatants);
    }

    public boolean containsId(CombatantId combatantId) {
        for (Combatant combatant : combatants) {
            if (combatantId != null && combatant.id().equals(combatantId.value())) {
                return true;
            }
        }
        return false;
    }

    public void replaceAll(List<Combatant> updatedCombatants) {
        combatants.clear();
        combatants.addAll(updatedCombatants);
    }

    public void sort() {
        combatants.sort(Combatant::compareByTurnOrder);
    }

    public void reconcilePlayers(List<PartyMemberData> party, CombatRosterBuilder builder) {
        List<PartyMemberData> members = party == null ? List.of() : List.copyOf(party);
        List<String> retainedIds = members.stream().map(PartyMemberData::id).toList();
        combatants.removeIf(combatant -> combatant.isPlayerCharacter() && !retainedIds.contains(combatant.id()));
        for (int index = 0; index < members.size(); index++) {
            PartyMemberData member = members.get(index);
            if (!containsId(CombatantId.from(member.id()))) {
                builder.addPlayerToRunningCombat(
                        this,
                        member.id(),
                        member.name(),
                        CombatRosterBuilder.defaultPlayerInitiative(index));
            }
        }
        sort();
    }

    public void reconcileSceneNpcs(
            List<EncounterCreatureData> hostile,
            List<EncounterCreatureData> friendly,
            CombatRosterBuilder builder
    ) {
        List<Long> retained = new ArrayList<>();
        hostile.forEach(value -> retained.add(value.worldNpcId()));
        friendly.forEach(value -> retained.add(value.worldNpcId()));
        combatants.removeIf(value -> value.worldNpcId() > 0L && !retained.contains(value.worldNpcId()));

        List<Combatant> reconciled = new ArrayList<>();
        for (Combatant combatant : combatants) {
            CombatantKind desiredKind = desiredSceneNpcKind(combatant.worldNpcId(), hostile, friendly);
            reconciled.add(desiredKind == null || combatant.kind() == desiredKind
                    ? combatant
                    : combatant.withKind(desiredKind));
        }
        replaceAll(reconciled);

        for (EncounterCreatureData ally : friendly) {
            builder.addAlly(this, ally, CombatRosterBuilder.defaultMonsterInitiative(ally.initiativeBonus()));
        }
        for (EncounterCreatureData enemy : hostile) {
            boolean exists = combatants.stream().anyMatch(value -> value.worldNpcId() == enemy.worldNpcId());
            if (!exists) {
                builder.addMonsters(
                        this,
                        enemy,
                        CombatRosterBuilder.defaultMonsterInitiative(enemy.initiativeBonus()),
                        combatants.size());
            }
        }
        sort();
    }

    private static CombatantKind desiredSceneNpcKind(
            long worldNpcId,
            List<EncounterCreatureData> hostile,
            List<EncounterCreatureData> friendly
    ) {
        if (worldNpcId <= 0L) {
            return null;
        }
        for (EncounterCreatureData enemy : hostile) {
            if (enemy.worldNpcId() == worldNpcId) {
                return CombatantKind.MONSTER;
            }
        }
        for (EncounterCreatureData ally : friendly) {
            if (ally.worldNpcId() == worldNpcId) {
                return CombatantKind.ALLY_NPC;
            }
        }
        return null;
    }
}
