package src.domain.party.model.roster;

import java.util.List;

public record PartyRosterMutation(
        PartyMutationStatus status,
        PartyRoster roster
) {

    public PartyRosterMutation {
        status = status == null ? PartyMutationStatus.storageError() : status;
        roster = copyRoster(roster);
    }

    @Override
    public PartyRoster roster() {
        return copyRoster(roster);
    }

    public static PartyRosterMutation success(PartyRoster roster) {
        return new PartyRosterMutation(PartyMutationStatus.SUCCESS, roster);
    }

    public static PartyRosterMutation invalidInput(PartyRoster roster) {
        return new PartyRosterMutation(PartyMutationStatus.INVALID_INPUT, roster);
    }

    public static PartyRosterMutation notFound(PartyRoster roster) {
        return new PartyRosterMutation(PartyMutationStatus.NOT_FOUND, roster);
    }

    public boolean successful() {
        return PartyMutationStatus.SUCCESS.equals(status);
    }

    private static PartyRoster copyRoster(PartyRoster roster) {
        if (roster == null) {
            return new PartyRoster(1L, List.of());
        }
        return new PartyRoster(roster.nextCharacterId(), roster.characters());
    }
}
