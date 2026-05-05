package src.domain.encounter.session.entity;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;

public final class CombatRuntime {

    public static final int FIRST_TURN_INDEX = 0;
    public static final int NO_ACTIVE_TURN_INDEX = -1;

    private static final int FIRST_COMBAT_ROUND = 1;
    private static final int MOB_MIN_SIZE = 4;
    private static final int MAX_CREATURES_PER_MOB = 10;
    private static final int DEFAULT_PLAYER_INITIATIVE = 10;
    private static final int DEFAULT_MONSTER_INITIATIVE = 12;
    private static final int MIN_INITIATIVE_BONUS = -3;
    private static final int MAX_INITIATIVE_BONUS = 6;

    private final List<Combatant> combatants = new ArrayList<>();

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

    public boolean addPlayerToRunningCombat(String id, String name, int initiative) {
        for (Combatant combatant : combatants) {
            if (combatant.id().equals(id)) {
                return false;
            }
        }
        combatants.add(Combatant.playerCharacter(id, name, initiative, nextOrder(combatants)));
        sort(combatants);
        return true;
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
            if (next == FIRST_TURN_INDEX) {
                nextRound++;
            }
            if (entries.get(next).alive()) {
                return new TurnAdvance(next, nextRound);
            }
        }
        return new TurnAdvance(currentTurnIndex, round);
    }

    public void setInitiative(String combatantId, int initiative) {
        updateInitiative(combatants, combatantId, initiative);
    }

    public boolean mutateHp(String combatantId, int amount, boolean healing) {
        return mutateHp(combatants, combatantId, amount, healing);
    }

    public List<EncounterSession.ResultEnemyData> resultEnemies() {
        return combatants.stream()
                .filter(combatant -> !combatant.playerCharacter())
                .map(combatant -> new EncounterSession.ResultEnemyData(
                        combatant.name(),
                        combatant.alive() ? "Lebt" : "Tot",
                        Math.max(0, combatant.maxHp() - combatant.currentHp()),
                        combatant.xp(),
                        !combatant.alive(),
                        combatant.loot()))
                .toList();
    }

    public EncounterSession.CombatProjectionData combatProjection(int requestedTurnIndex, int round) {
        List<TurnEntry> entries = turnEntries(combatants);
        int currentTurnIndex = normalizedTurnIndex(entries, requestedTurnIndex);
        List<EncounterSession.CombatCardData> cards = new ArrayList<>();
        int aliveEnemies = 0;
        int totalEnemies = 0;
        for (Combatant combatant : combatants) {
            if (!combatant.playerCharacter()) {
                totalEnemies++;
                if (combatant.alive()) {
                    aliveEnemies++;
                }
            }
        }
        for (int index = 0; index < entries.size(); index++) {
            TurnEntry entry = entries.get(index);
            cards.add(new EncounterSession.CombatCardData(
                    entry.id(),
                    entry.name(),
                    entry.playerCharacter(),
                    index == currentTurnIndex && entry.alive(),
                    entry.alive(),
                    entry.currentHp(),
                    entry.maxHp(),
                    entry.ac(),
                    entry.initiative(),
                    entry.count(),
                    entry.detail()));
        }
        String statusText = aliveEnemies + "/" + totalEnemies + " - " + LivePressure.from(aliveEnemies, totalEnemies).label();
        return new EncounterSession.CombatProjectionData(
                currentTurnIndex,
                round,
                statusText,
                cards,
                totalEnemies > 0 && aliveEnemies == 0);
    }

    public static int defaultPlayerInitiative(int partyIndex) {
        return DEFAULT_PLAYER_INITIATIVE + Math.max(0, partyIndex);
    }

    public static int defaultMonsterInitiative(int initiativeBonus) {
        return DEFAULT_MONSTER_INITIATIVE + Math.max(MIN_INITIATIVE_BONUS, Math.min(MAX_INITIATIVE_BONUS, initiativeBonus));
    }

    private static int normalizedTurnIndex(List<TurnEntry> entries, int requestedTurnIndex) {
        if (entries.isEmpty()) {
            return NO_ACTIVE_TURN_INDEX;
        }
        int currentTurnIndex = Math.max(FIRST_TURN_INDEX, Math.min(requestedTurnIndex, entries.size() - 1));
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

    private static void sort(List<Combatant> combatants) {
        combatants.sort(CombatRuntime::compareByTurnOrder);
    }

    private static int addPlayerCombatant(List<Combatant> combatants, String id, String name, int initiative, int order) {
        combatants.add(Combatant.playerCharacter(id, name, initiative, order));
        return order + 1;
    }

    private static int addMonsterCombatants(
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

    private static void updateInitiative(List<Combatant> combatants, String combatantId, int initiative) {
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

    private static boolean mutateHp(List<Combatant> combatants, String combatantId, int amount, boolean healing) {
        if (amount <= 0) {
            return false;
        }
        TurnEntry entry = turnEntry(combatants, combatantId);
        if (entry == null || entry.playerCharacter()) {
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

    private static List<TurnEntry> turnEntries(List<Combatant> combatants) {
        List<TurnEntry> entries = new ArrayList<>();
        List<List<Combatant>> aliveMonsterBuckets = new ArrayList<>();
        List<Combatant> deadMonsters = new ArrayList<>();
        for (Combatant combatant : combatants) {
            if (combatant.playerCharacter()) {
                entries.add(singleEntry(combatant, true));
            } else if (combatant.alive()) {
                aliveBucket(aliveMonsterBuckets, combatant).add(combatant);
            } else {
                deadMonsters.add(combatant);
            }
        }
        appendAliveMonsterBuckets(entries, aliveMonsterBuckets);
        deadMonsters.sort(CombatRuntime::compareByTurnOrder);
        for (Combatant combatant : deadMonsters) {
            entries.add(singleEntry(combatant, false));
        }
        entries.sort(CombatRuntime::compareEntriesByTurnOrder);
        return entries;
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

    private static void appendAliveMonsterBuckets(List<TurnEntry> entries, List<List<Combatant>> buckets) {
        for (List<Combatant> members : buckets) {
            members.sort(CombatRuntime::compareByHpThenName);
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
    }

    private static TurnEntry singleEntry(Combatant combatant, boolean alive) {
        return new TurnEntry(
                combatant.id(),
                combatant.name(),
                combatant.playerCharacter(),
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
        targets.sort(CombatRuntime::compareByHpThenName);
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
            if (!combatant.playerCharacter() && combatant.creatureId() == creatureId) {
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
        int byKind = Boolean.compare(!left.playerCharacter(), !right.playerCharacter());
        return byKind != 0 ? byKind : Integer.compare(left.order(), right.order());
    }

    private static int compareEntriesByTurnOrder(TurnEntry left, TurnEntry right) {
        int byInitiative = Integer.compare(right.initiative(), left.initiative());
        if (byInitiative != 0) {
            return byInitiative;
        }
        int byKind = Boolean.compare(!left.playerCharacter(), !right.playerCharacter());
        return byKind != 0 ? byKind : Integer.compare(left.order(), right.order());
    }

    private enum LivePressure {
        COLLAPSING(0.25, "Kippt"),
        CONTROLLED(0.50, "Unter Kontrolle"),
        DANGEROUS(0.75, "Gefaehrlich"),
        FULL_STRENGTH(1.00, "Volle Staerke");

        private final double remainingRatioLimit;
        private final String label;

        LivePressure(double remainingRatioLimit, String label) {
            this.remainingRatioLimit = remainingRatioLimit;
            this.label = label;
        }

        static LivePressure from(int aliveEnemies, int totalEnemies) {
            if (totalEnemies <= 0) {
                return COLLAPSING;
            }
            double ratio = aliveEnemies / (double) totalEnemies;
            for (LivePressure pressure : values()) {
                if (ratio <= pressure.remainingRatioLimit) {
                    return pressure;
                }
            }
            return FULL_STRENGTH;
        }

        String label() {
            return label;
        }
    }

    private record Combatant(
            String id,
            String name,
            EncounterSession.CombatantKind kind,
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
        private static Combatant playerCharacter(String id, String name, int initiative, int order) {
            return new Combatant(
                    id,
                    name,
                    EncounterSession.CombatantKind.PLAYER_CHARACTER,
                    0,
                    0,
                    0,
                    0,
                    initiative,
                    1,
                    0,
                    EncounterSession.CombatantKind.PLAYER_CHARACTER.publishedLabel(),
                    "",
                    order);
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
                    EncounterSession.CombatantKind.MONSTER,
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

        private boolean playerCharacter() {
            return kind == EncounterSession.CombatantKind.PLAYER_CHARACTER;
        }

        private boolean alive() {
            return playerCharacter() || currentHp > 0;
        }

        private Combatant withHp(int hitPoints) {
            return new Combatant(id, name, kind, creatureId, hitPoints, maxHp, ac, initiative, count, xp, detail, loot, order);
        }

        private Combatant withInitiative(int value) {
            return new Combatant(id, name, kind, creatureId, currentHp, maxHp, ac, value, count, xp, detail, loot, order);
        }
    }

    private record TurnEntry(
            String id,
            String name,
            boolean playerCharacter,
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
        private TurnEntry {
            memberIds = memberIds == null ? List.of() : List.copyOf(memberIds);
        }
    }

    public record TurnAdvance(int currentTurnIndex, int round) {
        public TurnAdvance {
            round = Math.max(FIRST_COMBAT_ROUND, round);
        }
    }
}
