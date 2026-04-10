package features.world.hexmap.catalog.input;

import features.world.hexmap.model.HexTile;

import java.util.List;

@SuppressWarnings("unused")
public record LoadInitialMapInput() {

    public record LoadedInitialMapInput(List<HexTile> tiles, Long partyTileId) {
    }
}
