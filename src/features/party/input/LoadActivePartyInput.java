package features.party.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadActivePartyInput() {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record PartyMemberInput(
            long id,
            String name,
            int level
    ) {
    }

    public record LoadedActivePartyInput(
            Status status,
            List<PartyMemberInput> members
    ) {
    }
}
