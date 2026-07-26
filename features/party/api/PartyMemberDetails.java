package features.party.api;

import org.jspecify.annotations.Nullable;

public record PartyMemberDetails(
        Long id,
        String name,
        @Nullable String playerName,
        @Nullable Integer level,
        int currentXp,
        @Nullable Integer currentLevelXp,
        @Nullable Integer nextLevelXp,
        @Nullable Integer xpToNextLevel,
        @Nullable Boolean readyToLevel,
        @Nullable Integer passivePerception,
        @Nullable Integer armorClass,
        int xpSinceShortRest,
        int xpSinceLongRest,
        int shortRestsTakenSinceLongRest,
        MembershipState membership
) {
}
