package src.domain.encounter.model.session.model;

import java.util.ArrayList;
import java.util.List;
import src.domain.encounter.model.session.model.Combatant;
import src.domain.encounter.model.session.model.CombatTurnEntry;

final class CombatTurnEntryAssembler {

    private static final int MOB_MIN_SIZE = 4;
    private static final int MAX_CREATURES_PER_MOB = 10;

    List<CombatTurnEntry> assemble(List<Combatant> combatants) {
        List<CombatTurnEntry> entries = new ArrayList<>();
        List<List<Combatant>> aliveMonsterBuckets = new ArrayList<>();
        List<Combatant> deadMonsters = new ArrayList<>();
        for (Combatant combatant : combatants) {
            if (combatant.isPlayerCharacter()) {
                entries.add(singleEntry(combatant, true));
            } else if (combatant.isAlive()) {
                aliveBucket(aliveMonsterBuckets, combatant).add(combatant);
            } else {
                deadMonsters.add(combatant);
            }
        }
        appendAliveMonsterBuckets(entries, aliveMonsterBuckets);
        deadMonsters.sort(Combatant::compareByTurnOrder);
        for (Combatant combatant : deadMonsters) {
            entries.add(singleEntry(combatant, false));
        }
        entries.sort(CombatTurnEntry::compareByTurnOrder);
        return entries;
    }

    private static List<Combatant> aliveBucket(List<List<Combatant>> buckets, Combatant combatant) {
        for (List<Combatant> bucket : buckets) {
            Combatant sample = bucket.getFirst();
            if (sample.sharesMobBucketWith(combatant)) {
                return bucket;
            }
        }
        List<Combatant> bucket = new ArrayList<>();
        buckets.add(bucket);
        return bucket;
    }

    private static void appendAliveMonsterBuckets(List<CombatTurnEntry> entries, List<List<Combatant>> buckets) {
        for (List<Combatant> members : buckets) {
            members.sort(Combatant::compareByHpThenName);
            int offset = 0;
            int partIndex = 0;
            for (int partSize : splitForMobSlots(members.size())) {
                List<Combatant> part = members.subList(offset, offset + partSize);
                offset += partSize;
                if (partSize >= MOB_MIN_SIZE) {
                    entries.add(mobEntry(part, partIndex));
                    partIndex++;
                    continue;
                }
                for (Combatant member : part) {
                    entries.add(singleEntry(member, true));
                }
            }
        }
    }

    private static CombatTurnEntry singleEntry(Combatant combatant, boolean alive) {
        return new CombatTurnEntry(
                combatant.id(),
                combatant.name(),
                combatant.isPlayerCharacter(),
                alive,
                combatant.currentHp(),
                combatant.maxHp(),
                combatant.ac(),
                combatant.initiative(),
                combatant.count(),
                combatant.detail(),
                combatant.order(),
                List.of(combatant.id()));
    }

    private static CombatTurnEntry mobEntry(List<Combatant> part, int partIndex) {
        Combatant front = part.getFirst();
        List<String> memberIds = new ArrayList<>();
        for (Combatant member : part) {
            memberIds.add(member.id());
        }
        String name = front.mobName();
        return new CombatTurnEntry(
                "mob:" + front.creatureId() + ":" + front.initiative() + ":" + partIndex,
                name,
                false,
                true,
                front.currentHp(),
                front.maxHp(),
                front.ac(),
                front.initiative(),
                part.size(),
                front.detail() + " | x" + part.size(),
                front.order(),
                memberIds);
    }

    private static List<Integer> splitForMobSlots(int count) {
        if (count < MOB_MIN_SIZE) {
            List<Integer> singles = new ArrayList<>();
            for (int index = 0; index < count; index++) {
                singles.add(1);
            }
            return singles;
        }
        if (count <= MAX_CREATURES_PER_MOB) {
            return List.of(count);
        }
        int groupCount = (int) Math.ceil(count / (double) MAX_CREATURES_PER_MOB);
        int base = count / groupCount;
        int remainder = count % groupCount;
        List<Integer> parts = new ArrayList<>();
        for (int index = 0; index < groupCount; index++) {
            parts.add(base + (index < remainder ? 1 : 0));
        }
        return parts;
    }
}
