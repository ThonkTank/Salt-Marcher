package features.world.hexmap.catalog.input;

import features.world.hexmap.model.HexTerrainType;

import java.util.Map;

@SuppressWarnings("unused")
public record FlushTerrainChangesInput(Map<Long, HexTerrainType> terrainChanges) {
}
