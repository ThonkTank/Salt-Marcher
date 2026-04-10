package features.world.hexmap.catalog.input;

@SuppressWarnings("unused")
public record CreateMapInput(String name, int radius) {

    public record CreatedMapInput(long mapId) {
    }
}
