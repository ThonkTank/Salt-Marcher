package features.world.hexmap.catalog.input;

@SuppressWarnings("unused")
public record UpdateMapInput(
        long mapId,
        String name,
        int oldRadius,
        int newRadius
) {
}
