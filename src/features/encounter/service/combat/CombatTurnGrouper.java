package features.encounter.service.combat;

import features.encounter.model.Combatant;
import features.encounter.model.MonsterCombatant;
import features.encounter.model.PcCombatant;

import java.util.ArrayList;
import java.util.Collections;
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
    private static final int MOB_MAX_SIZE = EncounterRules.MAX_CREATURES_PER_SLOT;

    /**
     * Builds runtime turn entries from already-sorted combatants.
     * @param combatants canonical individual combatants
     * @param pcTurns count of PC turns in current round (used for action-economy constraints)
     */
    public static List<GroupedTurnEntry> groupTurns(List<Combatant> combatants, int pcTurns) {
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
        List<Integer> bucketSizes = keys.stream().map(k -> aliveBuckets.get(k).size()).toList();
        List<Integer> desiredTurns = chooseBucketTurns(bucketSizes, Math.max(1, pcTurns));

        for (int i = 0; i < keys.size(); i++) {
            MobBucketKey key = keys.get(i);
            List<MonsterCombatant> members = aliveBuckets.get(key);
            members.sort(Comparator.comparingInt(MonsterCombatant::getCurrentHp).thenComparing(MonsterCombatant::getName));

            List<Integer> parts = compositionFor(members.size(), desiredTurns.get(i));
            if (parts.isEmpty()) parts = List.of(members.size());

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

    /**
     * Chooses per-bucket turn counts so monster turns stay within action-economy and time bounds.
     * Keeps as many turns as possible, then compresses only as needed.
     */
    public static List<Integer> chooseBucketTurns(List<Integer> bucketSizes, int pcTurns) {
        List<List<Integer>> feasible = new ArrayList<>();
        List<Integer> chosen = new ArrayList<>();

        for (int size : bucketSizes) {
            List<Integer> values = feasibleTurnCounts(size);
            feasible.add(values);
            chosen.add(values.get(values.size() - 1));
        }

        int lower = Math.max(1, (int) Math.ceil(pcTurns * 0.5));
        int upperBand = Math.max(1, (int) Math.floor(pcTurns * 1.25));
        int upperTime = Math.max(1, EncounterRules.MAX_TURNS_PER_ROUND - pcTurns);
        int upper = Math.max(lower, Math.min(upperBand, upperTime));

        int total = chosen.stream().mapToInt(Integer::intValue).sum();

        while (total > upper) {
            int bestIdx = -1;
            int bestDelta = Integer.MAX_VALUE;
            for (int i = 0; i < chosen.size(); i++) {
                int next = nextLower(feasible.get(i), chosen.get(i));
                if (next < 0) continue;
                int delta = chosen.get(i) - next;
                if (delta < bestDelta) {
                    bestDelta = delta;
                    bestIdx = i;
                }
            }
            if (bestIdx < 0) break;
            int next = nextLower(feasible.get(bestIdx), chosen.get(bestIdx));
            total -= (chosen.get(bestIdx) - next);
            chosen.set(bestIdx, next);
        }

        while (total < lower) {
            int bestIdx = -1;
            int bestDelta = Integer.MAX_VALUE;
            for (int i = 0; i < chosen.size(); i++) {
                int next = nextHigher(feasible.get(i), chosen.get(i));
                if (next < 0) continue;
                int delta = next - chosen.get(i);
                if (delta < bestDelta) {
                    bestDelta = delta;
                    bestIdx = i;
                }
            }
            if (bestIdx < 0) break;
            int next = nextHigher(feasible.get(bestIdx), chosen.get(bestIdx));
            total += (next - chosen.get(bestIdx));
            chosen.set(bestIdx, next);
        }

        return chosen;
    }

    public static List<Integer> compositionFor(int n, int turns) {
        Map<String, List<Integer>> memo = new LinkedHashMap<>();
        return compose(n, turns, memo);
    }

    private static List<Integer> feasibleTurnCounts(int n) {
        if (n <= 0) return List.of(0);
        List<Integer> counts = new ArrayList<>();
        for (int turns = 1; turns <= n; turns++) {
            if (!compositionFor(n, turns).isEmpty()) counts.add(turns);
        }
        if (counts.isEmpty()) counts.add(n);
        return counts;
    }

    private static int nextLower(List<Integer> feasible, int current) {
        int idx = feasible.indexOf(current);
        if (idx <= 0) return -1;
        return feasible.get(idx - 1);
    }

    private static int nextHigher(List<Integer> feasible, int current) {
        int idx = feasible.indexOf(current);
        if (idx < 0 || idx + 1 >= feasible.size()) return -1;
        return feasible.get(idx + 1);
    }

    private static List<Integer> compose(int remaining, int turnsLeft, Map<String, List<Integer>> memo) {
        String key = remaining + ":" + turnsLeft;
        if (memo.containsKey(key)) return memo.get(key);

        if (remaining == 0 && turnsLeft == 0) {
            List<Integer> ok = new ArrayList<>();
            memo.put(key, ok);
            return ok;
        }
        if (remaining <= 0 || turnsLeft <= 0) {
            memo.put(key, Collections.emptyList());
            return Collections.emptyList();
        }

        List<Integer> partSizes = new ArrayList<>();
        for (int s = Math.min(MOB_MAX_SIZE, remaining); s >= MOB_MIN_SIZE; s--) partSizes.add(s);
        partSizes.add(1);

        for (int size : partSizes) {
            List<Integer> rest = compose(remaining - size, turnsLeft - 1, memo);
            if (rest.isEmpty() && !(remaining - size == 0 && turnsLeft - 1 == 0)) continue;
            List<Integer> out = new ArrayList<>();
            out.add(size);
            out.addAll(rest);
            memo.put(key, out);
            return out;
        }

        memo.put(key, Collections.emptyList());
        return Collections.emptyList();
    }
}
