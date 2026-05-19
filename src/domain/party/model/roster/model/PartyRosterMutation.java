package src.domain.party.model.roster.model;

public record PartyRosterMutation(
        PartyMutationStatus status,
        PartyRoster roster
) {

    public PartyRosterMutation {
        status = status == null ? PartyMutationStatus.STORAGE_ERROR : status;
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
}
