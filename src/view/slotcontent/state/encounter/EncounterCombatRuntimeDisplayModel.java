package src.view.slotcontent.state.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;

public final class EncounterCombatRuntimeDisplayModel {

    private static final int MOB_MIN_SIZE = 4;
    private static final int MAX_CREATURES_PER_MOB = 10;

    private final List<Combatant> combatants = new ArrayList<>();

    public EncounterCombatRuntimeDisplayModel() {
    }

    public void clear() {
        combatants.clear();
    }

    public int addPlayer(String id, String name, int initiative, int order) {
        return addPlayerCombatant(combatants, id, name, initiative, order);
    }

    public int addMonsters(
            String id,
            String name,
            long creatureId,
            int count,
            int hp,
            int ac,
            int xp,
            String cr,
            String type,
            String role,
            int initiative,
            int order
    ) {
        return addMonsterCombatants(
                combatants,
                id,
                name,
                creatureId,
                count,
                hp,
                ac,
                xp,
                cr,
                type,
                role,
                initiative,
                order);
    }

    public void sort() {
        sort(combatants);
    }

    public boolean hasTurnEntries() {
        return !turnEntries(combatants).isEmpty();
    }

    public @Nullable String activeTurnId(int currentTurnIndex) {
        List<TurnEntry> entries = turnEntries(combatants);
        int index = normalizedTurnIndex(entries, currentTurnIndex);
        return index < 0 ? null : entries.get(index).id();
    }

    public int turnIndexOf(@Nullable String combatantId, int fallbackTurnIndex) {
        List<TurnEntry> entries = turnEntries(combatants);
        if (combatantId != null) {
            for (int index = 0; index < entries.size(); index++) {
                if (entries.get(index).id().equals(combatantId)) {
                    return index;
                }
            }
        }
        return normalizedTurnIndex(entries, fallbackTurnIndex);
    }

    public String addMonsterReinforcement(
            String name,
            long creatureId,
            int hp,
            int ac,
            int xp,
            String cr,
            String type,
            String role,
            int initiative
    ) {
        int nextOrdinal = nextMonsterOrdinal(combatants, creatureId);
        int nextOrder = nextOrder(combatants);
        String id = "reinforcement-" + creatureId + "-" + nextOrdinal;
        addMonsterCombatants(
                combatants,
                id,
                name,
                creatureId,
                1,
                hp,
                ac,
                xp,
                cr,
                type,
                role,
                initiative,
                nextOrder);
        sort(combatants);
        return uniqueMonsterName(name, nextOrdinal);
    }

    public TurnAdvance nextTurn(int currentTurnIndex, int round) {
        List<TurnEntry> entries = turnEntries(combatants);
        if (entries.isEmpty()) {
            return new TurnAdvance(currentTurnIndex, round);
        }
        int next = currentTurnIndex;
        int nextRound = round;
        for (int attempts = 0; attempts < entries.size(); attempts++) {
            next = (next + 1) % entries.size();
            if (next == 0) {
                nextRound++;
            }
            if (entries.get(next).alive()) {
                return new TurnAdvance(next, nextRound);
            }
        }
        return new TurnAdvance(currentTurnIndex, round);
    }

    public void setInitiative(String combatantId, int initiative) {
        setInitiative(combatants, combatantId, initiative);
    }

    public boolean mutateHp(String combatantId, int amount, boolean healing) {
        return mutateHp(combatants, combatantId, amount, healing);
    }

    public List<ResultEnemySnapshot> resultEnemies() {
        return combatants.stream()
                .filter(combatant -> !combatant.pc())
                .map(combatant -> new ResultEnemySnapshot(
                        combatant.name(),
                        combatant.alive() ? "Lebt" : "Tot",
                        Math.max(0, combatant.maxHp() - combatant.currentHp()),
                        combatant.xp(),
                        !combatant.alive(),
                        combatant.loot()))
                .toList();
    }

    public CombatProjection combatProjection(int requestedTurnIndex, int round) {
        List<TurnEntry> entries = turnEntries(combatants);
        int currentTurnIndex = normalizedTurnIndex(entries, requestedTurnIndex);
        List<CombatCardSnapshot> cards = new ArrayList<>();
        int aliveEnemies = 0;
        int totalEnemies = 0;
        for (Combatant combatant : combatants) {
            if (!combatant.pc()) {
                totalEnemies++;
                if (combatant.alive()) {
                    aliveEnemies++;
                }
            }
        }
        for (int index = 0; index < entries.size(); index++) {
            TurnEntry entry = entries.get(index);
            cards.add(new CombatCardSnapshot(
                    entry.id(),
                    entry.name(),
                    entry.pc(),
                    index == currentTurnIndex && entry.alive(),
                    entry.alive(),
                    entry.currentHp(),
                    entry.maxHp(),
                    entry.ac(),
                    entry.initiative(),
                    entry.count(),
                    entry.detail()));
        }
        String statusText = aliveEnemies + "/" + totalEnemies + " - " + liveDifficulty(totalEnemies, aliveEnemies);
        return new CombatProjection(
                currentTurnIndex,
                round,
                statusText,
                cards,
                totalEnemies > 0 && aliveEnemies == 0);
    }

    private static int normalizedTurnIndex(List<TurnEntry> entries, int requestedTurnIndex) {
        if (entries.isEmpty()) {
            return -1;
        }
        int currentTurnIndex = Math.max(0, Math.min(requestedTurnIndex, entries.size() - 1));
        if (entries.get(currentTurnIndex).alive()) {
            return currentTurnIndex;
        }
        for (int index = 0; index < entries.size(); index++) {
            if (entries.get(index).alive()) {
                return index;
            }
        }
        return currentTurnIndex;
    }

    private static String liveDifficulty(int totalEnemies, int aliveEnemies) {
        if (totalEnemies == 0) {
            return "Keine Gegner";
        }
        double ratio = aliveEnemies / (double) totalEnemies;
        if (ratio <= 0.25) {
            return "Kippt";
        }
        if (ratio <= 0.5) {
            return "Unter Kontrolle";
        }
        if (ratio <= 0.75) {
            return "Gefaehrlich";
        }
        return "Volle Staerke";
    }

    public static void sort(List<Combatant> combatants) {
        combatants.sort(EncounterCombatRuntimeDisplayModel::compareByTurnOrder);
    }

    public static int addPlayerCombatant(
            List<Combatant> combatants,
            String id,
            String name,
            int initiative,
            int order
    ) {
        combatants.add(Combatant.pc(id, name, initiative, order));
        return order + 1;
    }

    public static int addMonsterCombatants(
            List<Combatant> combatants,
            String id,
            String name,
            long creatureId,
            int count,
            int hp,
            int ac,
            int xp,
            String cr,
            String type,
            String role,
            int initiative,
            int order
    ) {
        int nextOrder = order;
        int firstOrdinal = nextMonsterOrdinal(combatants, creatureId);
        for (int creatureIndex = 1; creatureIndex <= count; creatureIndex++) {
            String displayName = count == 1 ? uniqueMonsterName(name, firstOrdinal) : name;
            combatants.add(Combatant.monster(
                    id,
                    displayName,
                    creatureId,
                    count,
                    hp,
                    ac,
                    xp,
                    cr,
                    type,
                    role,
                    initiative,
                    nextOrder++,
                    count == 1 ? 1 : creatureIndex));
        }
        return nextOrder;
    }

    public static void setInitiative(List<Combatant> combatants, String combatantId, int initiative) {
        TurnEntry entry = turnEntry(combatants, combatantId);
        if (entry == null) {
            return;
        }
        List<String> ids = entry.memberIds();
        for (int index = 0; index < combatants.size(); index++) {
            Combatant combatant = combatants.get(index);
            if (ids.contains(combatant.id())) {
                combatants.set(index, combatant.withInitiative(initiative));
            }
        }
        sort(combatants);
    }

    public static boolean mutateHp(List<Combatant> combatants, String combatantId, int amount, boolean healing) {
        if (amount <= 0) {
            return false;
        }
        TurnEntry entry = turnEntry(combatants, combatantId);
        if (entry == null || entry.pc()) {
            return false;
        }
        List<Combatant> targets = aliveMembers(combatants, entry.memberIds());
        if (targets.isEmpty()) {
            return false;
        }
        if (healing) {
            Combatant target = targets.getFirst();
            replace(combatants, target, Math.min(target.maxHp(), target.currentHp() + amount));
        } else {
            damage(combatants, targets, amount);
        }
        return true;
    }

    public static List<TurnEntry> turnEntries(List<Combatant> combatants) {
        List<TurnEntry> entries = new ArrayList<>();
        List<List<Combatant>> aliveMonsterBuckets = new ArrayList<>();
        List<Combatant> deadMonsters = new ArrayList<>();
        for (Combatant combatant : combatants) {
            collectCombatant(entries, aliveMonsterBuckets, deadMonsters, combatant);
        }
        appendAliveMonsterBuckets(entries, aliveMonsterBuckets);
        deadMonsters.sort(EncounterCombatRuntimeDisplayModel::compareByTurnOrder);
        for (Combatant combatant : deadMonsters) {
            entries.add(singleEntry(combatant, false));
        }
        entries.sort(EncounterCombatRuntimeDisplayModel::compareEntriesByTurnOrder);
        return entries;
    }

    private static void collectCombatant(
            List<TurnEntry> entries,
            List<List<Combatant>> aliveMonsterBuckets,
            List<Combatant> deadMonsters,
            Combatant combatant
    ) {
        if (combatant.pc()) {
            entries.add(singleEntry(combatant, true));
        } else if (combatant.alive()) {
            aliveBucket(aliveMonsterBuckets, combatant).add(combatant);
        } else {
            deadMonsters.add(combatant);
        }
    }

    private static List<Combatant> aliveBucket(List<List<Combatant>> buckets, Combatant combatant) {
        for (List<Combatant> bucket : buckets) {
            Combatant sample = bucket.getFirst();
            if (sample.creatureId() == combatant.creatureId()
                    && sample.initiative() == combatant.initiative()) {
                return bucket;
            }
        }
        List<Combatant> bucket = new ArrayList<>();
        buckets.add(bucket);
        return bucket;
    }

    private static void appendAliveMonsterBuckets(List<TurnEntry> entries, List<List<Combatant>> aliveMonsterBuckets) {
        for (List<Combatant> members : aliveMonsterBuckets) {
            members.sort(EncounterCombatRuntimeDisplayModel::compareByHpThenName);
            appendAliveMonsterBucket(entries, members);
        }
    }

    private static void appendAliveMonsterBucket(List<TurnEntry> entries, List<Combatant> members) {
        int offset = 0;
        int partIndex = 0;
        for (int partSize : splitForMobSlots(members.size())) {
            List<Combatant> part = members.subList(offset, offset + partSize);
            offset += partSize;
            if (partSize >= MOB_MIN_SIZE) {
                entries.add(mobEntry(part, partIndex++));
            } else {
                for (Combatant member : part) {
                    entries.add(singleEntry(member, true));
                }
            }
        }
    }

    private static TurnEntry singleEntry(Combatant combatant, boolean alive) {
        return new TurnEntry(
                combatant.id(),
                combatant.name(),
                combatant.pc(),
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

    private static TurnEntry mobEntry(List<Combatant> part, int partIndex) {
        Combatant front = part.getFirst();
        List<String> memberIds = new ArrayList<>();
        for (Combatant member : part) {
            memberIds.add(member.id());
        }
        String frontName = front.name();
        int marker = frontName.lastIndexOf(" #");
        String name = (marker > 0 ? frontName.substring(0, marker) : frontName) + " (Mob)";
        return new TurnEntry(
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

    private static @Nullable TurnEntry turnEntry(List<Combatant> combatants, String id) {
        for (TurnEntry entry : turnEntries(combatants)) {
            if (entry.id().equals(id)) {
                return entry;
            }
        }
        return null;
    }

    private static List<Combatant> aliveMembers(List<Combatant> combatants, List<String> ids) {
        List<Combatant> targets = new ArrayList<>();
        for (Combatant combatant : combatants) {
            if (ids.contains(combatant.id()) && combatant.alive()) {
                targets.add(combatant);
            }
        }
        targets.sort(EncounterCombatRuntimeDisplayModel::compareByHpThenName);
        return targets;
    }

    private static void replace(List<Combatant> combatants, Combatant target, int hp) {
        for (int index = 0; index < combatants.size(); index++) {
            if (combatants.get(index).id().equals(target.id())) {
                combatants.set(index, target.withHp(hp));
                return;
            }
        }
    }

    private static void damage(List<Combatant> combatants, List<Combatant> targets, int damage) {
        int remaining = damage;
        for (Combatant target : targets) {
            if (remaining <= 0) {
                return;
            }
            int appliedDamage = Math.min(remaining, target.currentHp());
            replace(combatants, target, target.currentHp() - appliedDamage);
            remaining -= appliedDamage;
        }
    }

    private static int nextMonsterOrdinal(List<Combatant> combatants, long creatureId) {
        int count = 0;
        for (Combatant combatant : combatants) {
            if (!combatant.pc() && combatant.creatureId() == creatureId) {
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

    private static int compareByHpThenName(Combatant left, Combatant right) {
        int byHp = Integer.compare(left.currentHp(), right.currentHp());
        return byHp != 0 ? byHp : left.name().compareTo(right.name());
    }

    private static int compareByTurnOrder(Combatant left, Combatant right) {
        int byInitiative = Integer.compare(right.initiative(), left.initiative());
        if (byInitiative != 0) {
            return byInitiative;
        }
        int byKind = Boolean.compare(!left.pc(), !right.pc());
        return byKind != 0 ? byKind : Integer.compare(left.order(), right.order());
    }

    private static int compareEntriesByTurnOrder(TurnEntry left, TurnEntry right) {
        int byInitiative = Integer.compare(right.initiative(), left.initiative());
        if (byInitiative != 0) {
            return byInitiative;
        }
        int byKind = Boolean.compare(!left.pc(), !right.pc());
        return byKind != 0 ? byKind : Integer.compare(left.order(), right.order());
    }

    public record Combatant(
            String id,
            String name,
            boolean pc,
            long creatureId,
            int currentHp,
            int maxHp,
            int ac,
            int initiative,
            int count,
            int xp,
            String detail,
            String loot,
            int order
    ) {
        public static Combatant pc(String id, String name, int initiative, int order) {
            return new Combatant(id, name, true, 0, 0, 0, 0, initiative, 1, 0, "SC", "", order);
        }

        private static Combatant monster(
                String id,
                String name,
                long creatureId,
                int count,
                int hitPoints,
                int ac,
                int xp,
                String cr,
                String type,
                String role,
                int initiative,
                int order,
                int creatureIndex
        ) {
            int hp = Math.max(1, hitPoints);
            String displayName = count > 1 ? name + " #" + creatureIndex : name;
            return new Combatant(
                    id + ":" + creatureIndex,
                    displayName,
                    false,
                    creatureId,
                    hp,
                    hp,
                    ac,
                    initiative,
                    1,
                    xp,
                    "CR " + cr + " | " + type + " | " + role.toLowerCase(Locale.ROOT),
                    "Kein Loot",
                    order);
        }

        public boolean alive() {
            return pc || currentHp > 0;
        }

        Combatant withHp(int hitPoints) {
            return new Combatant(id, name, pc, creatureId, hitPoints, maxHp, ac, initiative, count, xp, detail, loot, order);
        }

        Combatant withInitiative(int value) {
            return new Combatant(id, name, pc, creatureId, currentHp, maxHp, ac, value, count, xp, detail, loot, order);
        }
    }

    public record TurnEntry(
            String id,
            String name,
            boolean pc,
            boolean alive,
            int currentHp,
            int maxHp,
            int ac,
            int initiative,
            int count,
            String detail,
            int order,
            List<String> memberIds
    ) {
        public TurnEntry {
            memberIds = memberIds == null ? List.of() : List.copyOf(memberIds);
        }
    }

    public record TurnAdvance(int currentTurnIndex, int round) {
    }

    public record CombatProjection(
            int currentTurnIndex,
            int round,
            String status,
            List<CombatCardSnapshot> cards,
            boolean allEnemiesDefeated
    ) {
        public CombatProjection {
            cards = cards == null ? List.of() : List.copyOf(cards);
        }

        public static CombatProjection empty() {
            return new CombatProjection(-1, 1, "", List.of(), false);
        }
    }

    public record CombatCardSnapshot(
            String id,
            String name,
            boolean playerCharacter,
            boolean active,
            boolean alive,
            int currentHp,
            int maxHp,
            int armorClass,
            int initiative,
            int count,
            String detail
    ) {
    }

    public record ResultEnemySnapshot(
            String name,
            String status,
            int hpLoss,
            int xp,
            boolean defeatedByDefault,
            String loot
    ) {
    }
}
