package src.data.party.model;

public record PartyCharacterRecord(
        long id,
        Identity identity,
        Progress progress,
        Combat combat,
        String membership
) {
    public record Identity(String name, String playerName) {
    }

    public record Progress(
            int level,
            int currentXp,
            int xpSinceLongRest,
            int xpSinceShortRest,
            int shortRestsTakenSinceLongRest
    ) {
    }

    public record Combat(int passivePerception, int armorClass) {
    }
}
