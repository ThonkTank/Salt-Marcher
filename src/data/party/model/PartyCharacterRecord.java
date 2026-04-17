package src.data.party.model;

public record PartyCharacterRecord(
        long id,
        String name,
        String playerName,
        int level,
        int currentXp,
        int xpSinceLongRest,
        int xpSinceShortRest,
        int passivePerception,
        int armorClass,
        String membership
) {
}
