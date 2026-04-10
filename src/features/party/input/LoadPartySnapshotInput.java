package features.party.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadPartySnapshotInput() {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record CharacterInput(
            long id,
            String name,
            String playerName,
            int level,
            int currentXp,
            int xpSinceLongRest,
            int xpSinceShortRest,
            int passivePerception,
            int armorClass
    ) {
    }

    public record LoadedPartySnapshotInput(
            Status status,
            List<CharacterInput> members,
            List<CharacterInput> available
    ) {
    }
}
