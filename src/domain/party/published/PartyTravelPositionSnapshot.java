package src.domain.party.published;

import org.jspecify.annotations.Nullable;

public record PartyTravelPositionSnapshot(
        long characterId,
        boolean attachedToPartyToken,
        @Nullable PartyTravelLocationSnapshot location
) {

    public PartyTravelPositionSnapshot {
        characterId = Math.max(1L, characterId);
    }
}
