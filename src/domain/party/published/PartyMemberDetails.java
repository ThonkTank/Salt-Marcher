package src.domain.party.published;

public record PartyMemberDetails(
        Long id,
        String name,
        String playerName,
        int level,
        int currentXp,
        int xpToNextLevel,
        boolean readyToLevel,
        int passivePerception,
        int armorClass,
        int xpSinceShortRest,
        int xpSinceLongRest,
        int shortRestsTakenSinceLongRest,
        MembershipState membership
) {
}
