package features.party.api;

public record PartyMemberDetails(
        Long id,
        String name,
        String playerName,
        int level,
        int currentXp,
        int currentLevelXp,
        int nextLevelXp,
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
