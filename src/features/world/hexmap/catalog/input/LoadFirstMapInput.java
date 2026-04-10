package features.world.hexmap.catalog.input;

import features.world.hexmap.model.HexTile;

import java.util.List;

@SuppressWarnings("unused")
public record LoadFirstMapInput() {

    public record LoadedFirstMapInput(List<HexTile> tiles) {
    }
}
