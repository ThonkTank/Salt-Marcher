package src.domain.party.roster.value;

import org.jspecify.annotations.Nullable;

public record PartyCharacterTravelState(
        @Nullable PartyTravelLocation location,
        boolean attachedToPartyToken
) {

    public static PartyCharacterTravelState attachedWithoutLocation() {
        return new PartyCharacterTravelState(null, true);
    }
}
