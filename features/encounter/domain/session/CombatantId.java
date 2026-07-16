package features.encounter.domain.session;

public record CombatantId(String value) {

    public CombatantId {
        value = value == null ? "" : value;
    }

    public static CombatantId from(String rawValue) {
        return new CombatantId(rawValue);
    }

    public static CombatantId empty() {
        return new CombatantId("");
    }
}
