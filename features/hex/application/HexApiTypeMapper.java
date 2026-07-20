package features.hex.application;

final class HexApiTypeMapper {

    private HexApiTypeMapper() {
    }

    static features.hex.domain.map.HexTerrain domainTerrain(features.hex.api.HexTerrain terrain) {
        return switch (terrain == null ? features.hex.api.HexTerrain.defaultTerrain() : terrain) {
            case GRASSLAND -> features.hex.domain.map.HexTerrain.GRASSLAND;
            case FOREST -> features.hex.domain.map.HexTerrain.FOREST;
            case MOUNTAINS -> features.hex.domain.map.HexTerrain.MOUNTAINS;
            case WATER -> features.hex.domain.map.HexTerrain.WATER;
            case DESERT -> features.hex.domain.map.HexTerrain.DESERT;
            case SWAMP -> features.hex.domain.map.HexTerrain.SWAMP;
        };
    }

    static features.hex.api.HexTerrain publishedTerrain(features.hex.domain.map.HexTerrain terrain) {
        return switch (terrain == null ? features.hex.domain.map.HexTerrain.defaultTerrain() : terrain) {
            case GRASSLAND -> features.hex.api.HexTerrain.GRASSLAND;
            case FOREST -> features.hex.api.HexTerrain.FOREST;
            case MOUNTAINS -> features.hex.api.HexTerrain.MOUNTAINS;
            case WATER -> features.hex.api.HexTerrain.WATER;
            case DESERT -> features.hex.api.HexTerrain.DESERT;
            case SWAMP -> features.hex.api.HexTerrain.SWAMP;
        };
    }

    static features.hex.domain.map.HexMarkerKind domainMarkerKind(features.hex.api.HexMarkerKind kind) {
        if (kind == null) {
            return null;
        }
        return switch (kind) {
            case SETTLEMENT -> features.hex.domain.map.HexMarkerKind.SETTLEMENT;
            case LANDMARK -> features.hex.domain.map.HexMarkerKind.LANDMARK;
            case DANGER -> features.hex.domain.map.HexMarkerKind.DANGER;
            case RESOURCE -> features.hex.domain.map.HexMarkerKind.RESOURCE;
        };
    }

    static features.hex.api.HexMarkerKind publishedMarkerKind(features.hex.domain.map.HexMarkerKind kind) {
        return switch (kind == null ? features.hex.domain.map.HexMarkerKind.LANDMARK : kind) {
            case SETTLEMENT -> features.hex.api.HexMarkerKind.SETTLEMENT;
            case LANDMARK -> features.hex.api.HexMarkerKind.LANDMARK;
            case DANGER -> features.hex.api.HexMarkerKind.DANGER;
            case RESOURCE -> features.hex.api.HexMarkerKind.RESOURCE;
        };
    }
}
