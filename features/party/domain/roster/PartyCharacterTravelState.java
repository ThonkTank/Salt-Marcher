package features.party.domain.roster;

import org.jspecify.annotations.Nullable;

public record PartyCharacterTravelState(
        @Nullable PartyTravelLocation location,
        boolean attachedToPartyToken
) {

    public static PartyCharacterTravelState attachedWithoutLocation() {
        return new PartyCharacterTravelState(null, true);
    }

    public static PartyCharacterTravelState detached() {
        return new PartyCharacterTravelState(null, false);
    }
}
