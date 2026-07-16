package features.encounter.domain.session;


public record Combatant(
        String id,
        String name,
        CombatantKind kind,
        long creatureId,
        long worldNpcId,
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

    private static final String PLAYER_CHARACTER_DETAIL = "SC";
    private static final String DEFAULT_LOOT = "Kein Loot";

    public static Combatant playerCharacter(String id, String name, int initiative, int order) {
        return new Combatant(
                id,
                name,
                CombatantKind.playerCharacterKind(),
                0,
                0,
                0,
                0,
                0,
                initiative,
                1,
                0,
                PLAYER_CHARACTER_DETAIL,
                "",
                order);
    }

    public static Combatant monsterMember(
            String sourceId,
            String displayName,
            MonsterCombatProfile profile,
            long worldNpcId,
            int initiative,
            int order,
            int creatureIndex
    ) {
        return new Combatant(
                sourceId + ":" + creatureIndex,
                displayName,
                CombatantKind.MONSTER,
                profile.creatureId(),
                worldNpcId,
                profile.maxHp(),
                profile.maxHp(),
                profile.armorClass(),
                initiative,
                1,
                profile.xp(),
                profile.detail(),
                DEFAULT_LOOT,
                order);
    }

    public boolean isPlayerCharacter() {
        return kind.playerCharacter();
    }

    public boolean isAlive() {
        return isPlayerCharacter() || currentHp > 0;
    }

    public boolean sharesMobBucketWith(Combatant other) {
        return worldNpcId == 0L && other.worldNpcId() == 0L && creatureId == other.creatureId() && initiative == other.initiative();
    }

    public String mobName() {
        int marker = name.lastIndexOf(" #");
        return (marker > 0 ? name.substring(0, marker) : name) + " (Mob)";
    }

    public Combatant withHp(int hitPoints) {
        return new Combatant(id, name, kind, creatureId, worldNpcId, hitPoints, maxHp, ac, initiative, count, xp, detail, loot, order);
    }

    public Combatant withInitiative(int value) {
        return new Combatant(id, name, kind, creatureId, worldNpcId, currentHp, maxHp, ac, value, count, xp, detail, loot, order);
    }

    public static int compareByHpThenName(Combatant left, Combatant right) {
        int byHp = Integer.compare(left.currentHp(), right.currentHp());
        return byHp != 0 ? byHp : left.name().compareTo(right.name());
    }

    public static int compareByTurnOrder(Combatant left, Combatant right) {
        int byInitiative = Integer.compare(right.initiative(), left.initiative());
        if (byInitiative != 0) {
            return byInitiative;
        }
        int byKind = Boolean.compare(!left.isPlayerCharacter(), !right.isPlayerCharacter());
        return byKind != 0 ? byKind : Integer.compare(left.order(), right.order());
    }
}
