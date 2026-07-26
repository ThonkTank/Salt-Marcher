package features.encounter.domain.session;

import org.jspecify.annotations.Nullable;

public record PartyMemberData(String id, long numericId, String name, @Nullable Integer level) {
    public PartyMemberData {
        id = id == null ? "" : id;
        name = name == null ? "" : name;
    }
}
