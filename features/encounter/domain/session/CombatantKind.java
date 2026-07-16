package features.encounter.domain.session;

public enum CombatantKind {
    PLAYER_CHARACTER("SC"),
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
}
