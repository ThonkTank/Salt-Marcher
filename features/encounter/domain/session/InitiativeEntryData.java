package features.encounter.domain.session;

public record InitiativeEntryData(String id, String label, CombatantKind kind, int initiative) {
    public InitiativeEntryData {
        id = id == null ? "" : id;
        label = label == null ? "" : label;
        kind = kind == null ? CombatantKind.monsterKind() : kind;
    }
}
