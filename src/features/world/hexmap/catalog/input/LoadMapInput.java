package features.world.hexmap.catalog.input;

import features.world.hexmap.model.HexTile;

import java.util.List;

@SuppressWarnings("unused")
public record LoadMapInput(long mapId) {

    public record LoadedMapInput(List<HexTile> tiles) {
    }
}
