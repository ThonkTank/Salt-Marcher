package features.encounter.domain.session;

public record PartyMemberData(String id, long numericId, String name, int level) {
    public PartyMemberData {
        id = id == null ? "" : id;
        name = name == null ? "" : name;
    }
}
