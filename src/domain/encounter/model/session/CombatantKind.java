package src.domain.encounter.model.session;

public enum CombatantKind {
    PLAYER_CHARACTER("SC"),
    ALLY_NPC("Verbündeter"),
    MONSTER("Monster");

    private final String label;

    CombatantKind(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean playerCharacter() {
        return this == PLAYER_CHARACTER;
    }

    public static CombatantKind playerCharacterKind() {
        return PLAYER_CHARACTER;
    }

    public static CombatantKind monsterKind() {
        return MONSTER;
    }

    public boolean alliedNpc() { return this == ALLY_NPC; }
    public boolean enemy() { return this == MONSTER; }
}
