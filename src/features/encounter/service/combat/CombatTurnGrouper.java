package features.encounter.service.combat;

import features.encounter.model.Combatant;
import features.encounter.model.MonsterCombatant;
import features.encounter.model.PcCombatant;
import features.encounter.service.rules.EncounterMobSlotRules;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import features.encounter.service.rules.EncounterRules;

/**
 * Pure runtime grouping for combat turns.
 * Produces one initiative-flow list from individual combatants without mutating caller state.
 */
public final class CombatTurnGrouper {
    private CombatTurnGrouper() {
        throw new AssertionError("No instances");
    }

    public enum GroupedTurnKind { PC, MONSTER, MOB }

    public record GroupedTurnEntry(
            GroupedTurnKind kind,
            PcCombatant pc,
            List<MonsterCombatant> monsters,
            Long creatureId,
            int initiative,
            String name,
            int ac
    ) {}

    private record MobBucketKey(Long creatureId, int initiative) {}

    private static final int MOB_MIN_SIZE = EncounterRules.MOB_MIN_SIZE;

    /**
     * Builds runtime turn entries from already-sorted combatants.
     * @param combatants canonical individual combatants
     */
    public static List<GroupedTurnEntry> groupTurns(List<Combatant> combatants) {
        List<GroupedTurnEntry> turnEntries = new ArrayList<>();

        Map<MobBucketKey, List<MonsterCombatant>> aliveBuckets = new LinkedHashMap<>();
        List<MonsterCombatant> deadMonsters = new ArrayList<>();

        for (Combatant c : combatants) {
            if (c instanceof PcCombatant pc) {
                turnEntries.add(new GroupedTurnEntry(GroupedTurnKind.PC, pc, List.of(), null, pc.getInitiative(), pc.getName(), 0));
            } else if (c instanceof MonsterCombatant mc) {
                if (!mc.isAlive()) {
                    deadMonsters.add(mc);
                    continue;
                }
                Long creatureId = mc.getCreatureRef() != null ? mc.getCreatureRef().getId() : null;
                aliveBuckets.computeIfAbsent(new MobBucketKey(creatureId, mc.getInitiative()), k -> new ArrayList<>()).add(mc);
            }
        }

        List<MobBucketKey> keys = new ArrayList<>(aliveBuckets.keySet());
        for (MobBucketKey key : keys) {
            List<MonsterCombatant> members = aliveBuckets.get(key);
            members.sort(Comparator.comparingInt(MonsterCombatant::getCurrentHp).thenComparing(MonsterCombatant::getName));

            List<Integer> parts = EncounterMobSlotRules.splitForMobSlots(members.size());

            int pos = 0;
            for (int part : parts) {
                List<MonsterCombatant> slice = new ArrayList<>(members.subList(pos, pos + part));
                pos += part;
                MonsterCombatant front = slice.get(0);
                if (part >= MOB_MIN_SIZE) {
                    String mobName = (front.getCreatureRef() != null ? front.getCreatureRef().getName() : front.getName()) + " (Mob)";
                    turnEntries.add(new GroupedTurnEntry(
                            GroupedTurnKind.MOB,
                            null,
                            List.copyOf(slice),
                            key.creatureId(),
                            key.initiative(),
                            mobName,
                            front.getAc()
                    ));
                } else {
                    for (MonsterCombatant single : slice) {
                        Long cid = single.getCreatureRef() != null ? single.getCreatureRef().getId() : null;
                        turnEntries.add(new GroupedTurnEntry(
                                GroupedTurnKind.MONSTER,
                                null,
                                List.of(single),
                                cid,
                                single.getInitiative(),
                                single.getName(),
                                single.getAc()
                        ));
                    }
                }
            }
        }

        for (MonsterCombatant dead : deadMonsters) {
            Long cid = dead.getCreatureRef() != null ? dead.getCreatureRef().getId() : null;
            turnEntries.add(new GroupedTurnEntry(
                    GroupedTurnKind.MONSTER,
                    null,
                    List.of(dead),
                    cid,
                    dead.getInitiative(),
                    dead.getName(),
                    dead.getAc()
            ));
        }

        turnEntries.sort((a, b) -> {
            if (b.initiative() != a.initiative()) return b.initiative() - a.initiative();
            return Boolean.compare(b.kind() == GroupedTurnKind.PC, a.kind() == GroupedTurnKind.PC);
        });

        return turnEntries;
    }
}
