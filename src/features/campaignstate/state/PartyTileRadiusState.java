package features.campaignstate.state;

import features.campaignstate.input.ClearPartyTileOutsideRadiusInput;

@SuppressWarnings("unused")
public record PartyTileRadiusState(long mapId, int radius) {

    public static PartyTileRadiusState clearPartyTileOutsideRadius(ClearPartyTileOutsideRadiusInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new PartyTileRadiusState(input.mapId(), input.radius());
    }
}
