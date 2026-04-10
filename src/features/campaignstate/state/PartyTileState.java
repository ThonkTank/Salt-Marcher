package features.campaignstate.state;

import features.campaignstate.input.UpdatePartyTileInput;

@SuppressWarnings("unused")
public record PartyTileState(Long tileId) {

    public static PartyTileState updatePartyTile(UpdatePartyTileInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new PartyTileState(input.tileId());
    }
}
