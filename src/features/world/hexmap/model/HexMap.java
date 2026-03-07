package features.world.hexmap.model;

public record HexMap(Long mapId, String name, boolean bounded, Integer radius) {
    public HexMap {
        if (bounded && radius == null) {
            throw new IllegalArgumentException("radius must be set for bounded maps");
        }
        if (radius != null && radius < 0) {
            throw new IllegalArgumentException("radius must be >= 0");
        }
    }
}
