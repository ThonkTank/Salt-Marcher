package features.world.hexmap.catalog.input;

import features.world.hexmap.model.HexMap;

import java.util.List;

@SuppressWarnings("unused")
public record LoadMapListInput() {

    public record LoadedMapListInput(List<HexMap> maps) {
    }
}
